// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

interface IRemark {
    function saveRemark(
        uint256 poolId,
        uint256 taskId,
        string calldata senderRemark,
        string calldata receiverRemark
    ) external;
}

/// @notice TaskPool V2（通过 Proxy 使用）
/// 目标口径（社区版）：
/// - Publisher deposit 形成 credit；Manager 代为 createTaskPool 从 credit 锁定池子资金
/// - 子任务为「固定金额」，在 claim 时写入并计入锁定分配；未领取/撤回/过期部分在结算时退款
/// - 所有子任务终态后进入 24h 公示期（publicize），期间锁定回收/撤回/改金额等资金归属操作
/// - 公示期结束后任何人可调用 distribute 直接给接包者转账；refund 退回 publisher（失败则进 credit）
/// - 申诉时 admin 可 pause，阻止 distribute；pause 后由 arbitrationExecutor 调 adminDistribute 兜底分发/退款
/// - 备注：Manager 通过子任务时不写上链备注；Publisher 终审开启公示时若配置了 remarkProxy，将链下收集的整单评语 + 各已完成子任务接包者评语批量写入备注合约（taskId==0 为整池 Publisher 评语）
/// - 凭证提交截止 credentialDeadline（建池签名）：仅在此时间之后允许 cancelClaimedTask（已领未完成）；须 credentialDeadline > claimDeadline
contract TaskPoolLogicV2 {
    // ========= EIP-712 (Typed Data) =========
    string public constant EIP712_NAME = "TaskPool";
    string public constant EIP712_VERSION = "4";
    bytes32 private constant _EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _CREATE_POOL_TYPEHASH =
        keccak256(
            "CreateTaskPool(uint256 poolId,address publisher,address manager,bytes32 taskIdsHash,bytes32 taskMaxAmountsHash,uint256 lockedBalance,uint256 claimDeadline,uint256 credentialDeadline,uint256 nonce,uint256 sigDeadline)"
        );
    bytes32 private constant _CLAIM_TASK_TYPEHASH =
        keccak256(
            "ClaimTask(uint256 poolId,uint256 taskId,address claimer,uint256 amount,uint256 taskClaimNonce,uint256 sigDeadline)"
        );

    struct CreatePoolSigParams {
        uint256 poolId;
        address publisher;
        address manager;
        bytes32 taskIdsHash;
        bytes32 taskMaxAmountsHash;
        uint256 lockedBalance;
        uint256 claimDeadline;
        uint256 credentialDeadline;
        uint256 nonce;
        uint256 sigDeadline;
    }

    struct ClaimTaskSigParams {
        uint256 poolId;
        uint256 taskId;
        address claimer;
        uint256 amount;
        uint256 taskClaimNonce;
        uint256 sigDeadline;
    }

    function _domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                _EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(EIP712_NAME)),
                keccak256(bytes(EIP712_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    function _hashTypedDataV4(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domainSeparatorV4(), structHash));
    }

    function _hashCreatePoolTypedData(CreatePoolSigParams memory p) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                _CREATE_POOL_TYPEHASH,
                p.poolId,
                p.publisher,
                p.manager,
                p.taskIdsHash,
                p.taskMaxAmountsHash,
                p.lockedBalance,
                p.claimDeadline,
                p.credentialDeadline,
                p.nonce,
                p.sigDeadline
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function _hashClaimTaskTypedData(ClaimTaskSigParams memory p) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                _CLAIM_TASK_TYPEHASH,
                p.poolId,
                p.taskId,
                p.claimer,
                p.amount,
                p.taskClaimNonce,
                p.sigDeadline
            )
        );
        return _hashTypedDataV4(structHash);
    }

    // ========= Storage layout (Proxy critical) =========
    IERC20 public pointToken;     // NT
    address public admin;         // 平台地址
    address public arbitrationExecutor; // 兜底分发执行者（默认=admin，可更新）
    address public remarkProxy;   // 可选备注合约
    bool private _initialized;

    mapping(address => uint256) public credit;
    mapping(address => uint256) public creditNonces;

    enum TaskStatus {
        Open,        // 已创建未终态（可未领取/已领取未完成）
        Completed,   // 已审核通过（可参与分发）
        Cancelled,   // 撤回/作废（退款给 publisher）
        Expired      // 过期回收（退款给 publisher）
    }

    struct Task {
        address assignee;     // 领取者（0=未领取）
        uint256 amount;       // 固定金额（claim 时写入；或在未领取阶段可由 manager 调整）
        uint256 maxAmount;    // 可领取/可调整的上限（由建池签名参数提供；0 表示不限制但仍受池总额约束）
        uint256 claimNonce;   // 子任务 claim nonce（用于防止驳回回池后复用旧签名）
        TaskStatus status;    // 终态见上
        bool exists;
    }

    struct Pool {
        address publisher;        // 出资者
        address manager;          // 运营者（拆解/子任务审核）
        uint256 lockedBalance;    // 池内锁定总额（来自 credit[publisher]）
        uint256 allocated;        // 已分配金额总和（用于约束 sum(amount) <= lockedBalance）
        uint256 claimDeadline;    // 领取截止（仅限制 claim/未领取调整）

        uint64 publicizeEligibleAt; // 进入公示期的时间点（=finalApprove 时刻）
        uint64 publicizeEndsAt;     // 公示期结束（=eligibleAt+24h）
        bool paused;               // 申诉暂停
        bool settled;              // 是否已结算关闭

        uint256[] taskIds;
        bool exists;
        /// @dev 凭证提交截止，须晚于 claimDeadline（建池时校验）。仅当当前时间晚于此，才允许 cancelClaimedTask。为 0 表示旧版池：取消已领取子任务时回退为须已过 claimDeadline。
        uint256 credentialDeadline;
        bool poolRejected;
    }

    mapping(uint256 => Pool) public pools; // poolId -> Pool
    mapping(uint256 => mapping(uint256 => Task)) public poolTasks; // poolId -> taskId -> Task

    // ========= Events =========
    event Initialized(address pointToken, address admin);
    event RemarkProxySet(address remarkProxy);
    event ArbitrationExecutorSet(address arbitrationExecutor);

    event Deposited(address indexed publisher, uint256 amount);
    event Withdrawn(address indexed publisher, uint256 amount);

    event PoolCreated(
        uint256 indexed poolId,
        address indexed publisher,
        address indexed manager,
        uint256 lockedBalance,
        uint256 claimDeadline,
        uint256 credentialDeadline
    );

    event TaskClaimed(uint256 indexed poolId, uint256 indexed taskId, address indexed assignee, uint256 amount);

    event SubtaskApproved(uint256 indexed poolId, uint256 indexed taskId, address indexed manager);
    event SubtaskRejected(uint256 indexed poolId, uint256 indexed taskId, address indexed manager);

    event PoolFinalApproved(uint256 indexed poolId, uint64 publicizeEligibleAt, uint64 publicizeEndsAt);
    event PoolRejected(uint256 indexed poolId, address indexed publisher);
    event PoolPaused(uint256 indexed poolId, bool paused);

    event Distributed(uint256 indexed poolId, uint256 paidOut, uint256 refund, bool refundToCredit);
    event AdminDistributed(uint256 indexed poolId, uint256 paidOut, uint256 refund, address refundTo);

    // ========= Errors =========
    error NotAdmin();
    error NotPublisher();
    error NotManager();
    error NotArbitrationExecutor();
    error NotPublisherOrAdmin();
    error BadSigner();
    error SignatureExpired();
    error BadNonce();
    error InsufficientCredit();
    error PoolClosed();
    error PublicizingOrSettled();
    error NotPublicizeEnded();
    error PoolPausedErr();
    error BadAmount();
    error ExceedLockedBalance();
    error BadRemarkBatch();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier poolExists(uint256 poolId) {
        require(pools[poolId].exists, "POOL_NOT_EXISTS");
        _;
    }

    modifier onlyPublisher(uint256 poolId) {
        if (pools[poolId].publisher != msg.sender) revert NotPublisher();
        _;
    }

    modifier onlyManager(uint256 poolId) {
        if (pools[poolId].manager != msg.sender) revert NotManager();
        _;
    }

    modifier onlyPublisherOrAdmin(uint256 poolId) {
        if (msg.sender != pools[poolId].publisher && msg.sender != admin) revert NotPublisherOrAdmin();
        _;
    }

    modifier onlyManagerOrAdmin(uint256 poolId) {
        if (msg.sender != pools[poolId].manager && msg.sender != admin) revert NotManager();
        _;
    }

    modifier onlyArbitrationExecutor() {
        if (msg.sender != arbitrationExecutor) revert NotArbitrationExecutor();
        _;
    }

    // ========= Initialize / config =========
    function initialize(address _pointToken, address _admin) external {
        require(!_initialized, "ALREADY_INIT");
        require(_pointToken != address(0), "ZERO_TOKEN");
        require(_admin != address(0), "ZERO_ADMIN");
        pointToken = IERC20(_pointToken);
        admin = _admin;
        arbitrationExecutor = _admin;
        _initialized = true;
        emit Initialized(_pointToken, _admin);
        emit ArbitrationExecutorSet(_admin);
    }

    function setRemarkProxy(address _remarkProxy) external onlyAdmin {
        remarkProxy = _remarkProxy;
        emit RemarkProxySet(_remarkProxy);
    }

    function setArbitrationExecutor(address _executor) external onlyAdmin {
        require(_executor != address(0), "ZERO_EXECUTOR");
        arbitrationExecutor = _executor;
        emit ArbitrationExecutorSet(_executor);
    }

    // ========= Credit (deposit/withdraw) =========
    function deposit(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(pointToken.transferFrom(msg.sender, address(this), amount), "TRANSFER_FAILED");
        credit[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        uint256 bal = credit[msg.sender];
        require(bal >= amount, "INSUFFICIENT_CREDIT");
        unchecked {
            credit[msg.sender] = bal - amount;
        }
        require(pointToken.transfer(msg.sender, amount), "TRANSFER_FAILED");
        emit Withdrawn(msg.sender, amount);
    }

    // ========= Create pool =========
    function createTaskPool(
        uint256 poolId,
        address publisher,
        uint256[] calldata taskIds,
        uint256[] calldata taskMaxAmounts,
        uint256 lockedBalance,
        uint256 claimDeadline,
        uint256 credentialDeadline,
        uint256 nonce,
        uint256 sigDeadline,
        bytes calldata signature
    ) external {
        require(!pools[poolId].exists, "POOL_EXISTS");
        require(publisher != address(0), "ZERO_PUBLISHER");
        require(taskIds.length > 0, "NO_TASKS");
        require(taskIds.length == taskMaxAmounts.length, "LENGTH_MISMATCH");
        require(lockedBalance > 0, "ZERO_LOCK");
        require(credentialDeadline > claimDeadline, "BAD_CREDENTIAL_DEADLINE");
        if (block.timestamp > sigDeadline) revert SignatureExpired();

        bytes32 taskIdsHash = keccak256(abi.encodePacked(taskIds));
        bytes32 maxAmountsHash = keccak256(abi.encodePacked(taskMaxAmounts));
        bytes32 digest = _hashCreatePoolTypedData(
            CreatePoolSigParams({
                poolId: poolId,
                publisher: publisher,
                manager: msg.sender,
                taskIdsHash: taskIdsHash,
                taskMaxAmountsHash: maxAmountsHash,
                lockedBalance: lockedBalance,
                claimDeadline: claimDeadline,
                credentialDeadline: credentialDeadline,
                nonce: nonce,
                sigDeadline: sigDeadline
            })
        );
        if (!SignatureChecker.isValidSignatureNow(publisher, digest, signature)) revert BadSigner();

        if (creditNonces[publisher] != nonce) revert BadNonce();
        unchecked {
            creditNonces[publisher] = nonce + 1;
        }

        uint256 bal = credit[publisher];
        if (bal < lockedBalance) revert InsufficientCredit();
        unchecked {
            credit[publisher] = bal - lockedBalance;
        }

        Pool storage p = pools[poolId];
        p.publisher = publisher;
        p.manager = msg.sender;
        p.lockedBalance = lockedBalance;
        p.claimDeadline = claimDeadline;
        p.credentialDeadline = credentialDeadline;
        p.exists = true;
        p.taskIds = taskIds;

        uint256 len = taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 taskId = taskIds[i];
            require(!poolTasks[poolId][taskId].exists, "TASK_DUP");
            poolTasks[poolId][taskId] = Task({
                assignee: address(0),
                amount: 0,
                maxAmount: taskMaxAmounts[i],
                claimNonce: 0,
                status: TaskStatus.Open,
                exists: true
            });
        }

        emit PoolCreated(poolId, publisher, msg.sender, lockedBalance, claimDeadline, credentialDeadline);
    }

    function claimTask(
        uint256 poolId,
        uint256 taskId,
        uint256 amount,
        uint256 sigDeadline,
        bytes calldata signature
    ) external poolExists(poolId) {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        if (_isPublicizing(p)) revert PublicizingOrSettled();

        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(t.status == TaskStatus.Open, "TASK_NOT_OPEN");
        require(t.assignee == address(0), "ALREADY_CLAIMED");
        require(block.timestamp <= p.claimDeadline, "DEADLINE_PASSED");
        if (block.timestamp > sigDeadline) revert SignatureExpired();

        address signer = p.manager;
        bytes32 digest = _hashClaimTaskTypedData(
            ClaimTaskSigParams({
                poolId: poolId,
                taskId: taskId,
                claimer: msg.sender,
                amount: amount,
                taskClaimNonce: t.claimNonce,
                sigDeadline: sigDeadline
            })
        );
        if (
            !SignatureChecker.isValidSignatureNow(signer, digest, signature)
            && !SignatureChecker.isValidSignatureNow(admin, digest, signature)
        ) {
            revert BadSigner();
        }

        _setTaskAmountAndAllocate(p, t, amount);
        t.assignee = msg.sender;
        unchecked {
            t.claimNonce += 1;
        }

        emit TaskClaimed(poolId, taskId, msg.sender, amount);
    }

    function _setTaskAmountAndAllocate(Pool storage p, Task storage t, uint256 amount) internal {
        if (amount == 0) revert BadAmount();
        if (t.maxAmount != 0 && amount > t.maxAmount) revert BadAmount();
        uint256 nextAllocated = p.allocated + amount;
        if (nextAllocated > p.lockedBalance) revert ExceedLockedBalance();
        p.allocated = nextAllocated;
        t.amount = amount;
    }

    function approveSubtask(uint256 poolId, uint256 taskId)
        external
        poolExists(poolId)
        onlyManagerOrAdmin(poolId)
    {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        if (_isPublicizing(p)) revert PublicizingOrSettled();

        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(t.status == TaskStatus.Open, "TASK_NOT_OPEN");
        require(t.assignee != address(0), "NOT_CLAIMED");
        require(t.amount > 0, "AMOUNT_NOT_SET");

        t.status = TaskStatus.Completed;

        emit SubtaskApproved(poolId, taskId, msg.sender);
    }

    function rejectSubtask(uint256 poolId, uint256 taskId)
        external
        poolExists(poolId)
        onlyManagerOrAdmin(poolId)
    {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        if (_isPublicizing(p)) revert PublicizingOrSettled();

        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(t.status == TaskStatus.Open, "TASK_NOT_OPEN");
        require(t.assignee != address(0), "NOT_CLAIMED");
        _requirePastCredentialDeadline(p);

        if (t.amount > 0) {
            unchecked {
                p.allocated -= t.amount;
            }
        }
        t.amount = 0;
        t.assignee = address(0);

        emit SubtaskRejected(poolId, taskId, msg.sender);
    }

    function cancelUnclaimedTask(uint256 poolId, uint256 taskId) external poolExists(poolId) onlyManagerOrAdmin(poolId) {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        if (_isPublicizing(p)) revert PublicizingOrSettled();

        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(t.status == TaskStatus.Open, "TASK_NOT_OPEN");
        require(t.assignee == address(0), "ALREADY_CLAIMED");

        if (t.amount > 0) {
            unchecked {
                p.allocated -= t.amount;
            }
            t.amount = 0;
        }
        t.status = TaskStatus.Cancelled;
    }

    function cancelClaimedTask(uint256 poolId, uint256 taskId) external poolExists(poolId) onlyManagerOrAdmin(poolId) {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        if (_isPublicizing(p)) revert PublicizingOrSettled();
        _requirePastCredentialDeadline(p);

        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(t.status == TaskStatus.Open, "TASK_NOT_OPEN");
        require(t.assignee != address(0), "NOT_CLAIMED");

        if (t.amount > 0) {
            unchecked {
                p.allocated -= t.amount;
            }
            t.amount = 0;
        }
        t.status = TaskStatus.Cancelled;
    }

    function expireUnclaimedTask(uint256 poolId, uint256 taskId) external poolExists(poolId) onlyManagerOrAdmin(poolId) {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        if (_isPublicizing(p)) revert PublicizingOrSettled();
        require(block.timestamp > p.claimDeadline, "DEADLINE_NOT_PASSED");

        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(t.status == TaskStatus.Open, "TASK_NOT_OPEN");
        require(t.assignee == address(0), "ALREADY_CLAIMED");

        if (t.amount > 0) {
            unchecked {
                p.allocated -= t.amount;
            }
            t.amount = 0;
        }
        t.status = TaskStatus.Expired;
    }

    function finalApprovePool(
        uint256 poolId,
        string calldata publisherRemark,
        uint256[] calldata remarkTaskIds,
        string[] calldata assigneeRemarks
    ) external poolExists(poolId) onlyPublisher(poolId) {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        require(!_isPublicizing(p), "ALREADY_PUBLICIZING");
        require(_allTasksTerminal(poolId), "TASKS_NOT_TERMINAL");

        if (remarkProxy != address(0)) {
            _saveFinalRemarks(poolId, p, publisherRemark, remarkTaskIds, assigneeRemarks);
        } else {
            if (bytes(publisherRemark).length != 0 || remarkTaskIds.length != 0) revert BadRemarkBatch();
        }

        uint64 start = uint64(block.timestamp);
        uint64 end = start + 24 hours;
        p.publicizeEligibleAt = start;
        p.publicizeEndsAt = end;

        emit PoolFinalApproved(poolId, start, end);
    }

    function finalRejectPool(uint256 poolId) external poolExists(poolId) onlyPublisher(poolId) {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        if (_isPublicizing(p)) revert PublicizingOrSettled();
        require(p.publicizeEligibleAt == 0, "ALREADY_FINAL_APPROVED");
        require(!_hasAnyClaimed(poolId), "HAS_CLAIMED");
        require(!_hasAnyCompleted(poolId), "HAS_COMPLETED");
        _requirePastCredentialDeadline(p);

        uint256 len = p.taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.status != TaskStatus.Open) continue;
            if (t.amount > 0) {
                unchecked {
                    p.allocated -= t.amount;
                }
                t.amount = 0;
            }
            t.assignee = address(0);
            t.status = TaskStatus.Cancelled;
        }

        uint256 refund = p.lockedBalance;
        if (refund > 0) {
            credit[p.publisher] += refund;
            p.lockedBalance = 0;
        }

        p.poolRejected = true;
        p.settled = true;
        emit PoolRejected(poolId, msg.sender);
    }

    function _saveFinalRemarks(
        uint256 poolId,
        Pool storage p,
        string calldata publisherRemark,
        uint256[] calldata remarkTaskIds,
        string[] calldata assigneeRemarks
    ) internal {
        uint256 len = remarkTaskIds.length;
        if (len != assigneeRemarks.length) revert BadRemarkBatch();

        for (uint256 i = 0; i < len; i++) {
            for (uint256 j = i + 1; j < len; j++) {
                if (remarkTaskIds[i] == remarkTaskIds[j]) revert BadRemarkBatch();
            }
            uint256 tid = remarkTaskIds[i];
            Task storage t = poolTasks[poolId][tid];
            if (!t.exists || t.status != TaskStatus.Completed || t.assignee == address(0)) revert BadRemarkBatch();
        }

        uint256 completedInPool = 0;
        uint256 plen = p.taskIds.length;
        for (uint256 i = 0; i < plen; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.status != TaskStatus.Completed) continue;
            if (t.assignee == address(0)) continue;
            completedInPool++;
        }
        if (len != completedInPool) revert BadRemarkBatch();

        IRemark r = IRemark(remarkProxy);
        r.saveRemark(poolId, 0, "", publisherRemark);
        for (uint256 i = 0; i < len; i++) {
            r.saveRemark(poolId, remarkTaskIds[i], assigneeRemarks[i], "");
        }
    }

    function pausePool(uint256 poolId, bool paused) external poolExists(poolId) onlyAdmin {
        Pool storage p = pools[poolId];
        require(_isPublicizing(p) || _isAfterPublicize(p), "NOT_PUBLICIZING");
        p.paused = paused;
        emit PoolPaused(poolId, paused);
    }

    function distribute(uint256 poolId) external poolExists(poolId) {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        if (p.paused) revert PoolPausedErr();
        if (!_isAfterPublicize(p)) revert NotPublicizeEnded();

        (uint256 paidOut, uint256 refund) = _payoutAndRefund(poolId, p);

        bool refundToCredit = false;
        if (refund > 0) {
            bool ok = pointToken.transfer(p.publisher, refund);
            if (!ok) {
                credit[p.publisher] += refund;
                refundToCredit = true;
            }
        }

        p.settled = true;
        emit Distributed(poolId, paidOut, refund, refundToCredit);
    }

    function adminDistribute(
        uint256 poolId,
        address[] calldata recipients,
        uint256[] calldata amounts,
        address refundTo
    ) external poolExists(poolId) onlyArbitrationExecutor {
        Pool storage p = pools[poolId];
        if (p.settled) revert PoolClosed();
        require(p.paused, "NOT_PAUSED");
        require(_isPublicizing(p) || _isAfterPublicize(p), "NOT_PUBLICIZING");
        require(recipients.length == amounts.length, "LENGTH_MISMATCH");
        require(refundTo != address(0), "ZERO_REFUND_TO");

        uint256 paidOut = 0;
        uint256 len = recipients.length;
        for (uint256 i = 0; i < len; i++) {
            uint256 a = amounts[i];
            if (a == 0) continue;
            paidOut += a;
            require(pointToken.transfer(recipients[i], a), "TRANSFER_FAILED");
        }
        require(paidOut <= p.lockedBalance, "EXCEED_POOL_BALANCE");
        uint256 refund = p.lockedBalance - paidOut;
        if (refund > 0) {
            bool ok = pointToken.transfer(refundTo, refund);
            if (!ok) {
                credit[refundTo] += refund;
            }
        }

        p.settled = true;
        emit AdminDistributed(poolId, paidOut, refund, refundTo);
    }

    function _payoutAndRefund(uint256 poolId, Pool storage p) internal returns (uint256 paidOut, uint256 refund) {
        uint256 len = p.taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.status != TaskStatus.Completed) continue;
            uint256 a = t.amount;
            if (a == 0) continue;
            paidOut += a;
            require(pointToken.transfer(t.assignee, a), "TRANSFER_FAILED");
        }
        require(paidOut <= p.lockedBalance, "EXCEED_POOL_BALANCE");
        refund = p.lockedBalance - paidOut;
    }

    function _requirePastCredentialDeadline(Pool storage p) internal view {
        uint256 cd = p.credentialDeadline;
        if (cd == 0) {
            require(block.timestamp > p.claimDeadline, "CREDENTIAL_DEADLINE_NOT_PASSED");
        } else {
            require(block.timestamp > cd, "CREDENTIAL_DEADLINE_NOT_PASSED");
        }
    }

    function _isPublicizing(Pool storage p) internal view returns (bool) {
        return p.publicizeEligibleAt != 0 && block.timestamp < p.publicizeEndsAt;
    }

    function _isAfterPublicize(Pool storage p) internal view returns (bool) {
        return p.publicizeEligibleAt != 0 && block.timestamp >= p.publicizeEndsAt;
    }

    function _allTasksTerminal(uint256 poolId) internal view returns (bool) {
        Pool storage p = pools[poolId];
        uint256 len = p.taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.status == TaskStatus.Open) return false;
        }
        return true;
    }

    function _hasAnyCompleted(uint256 poolId) internal view returns (bool) {
        Pool storage p = pools[poolId];
        uint256 len = p.taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.status == TaskStatus.Completed) return true;
        }
        return false;
    }

    function _hasAnyClaimed(uint256 poolId) internal view returns (bool) {
        Pool storage p = pools[poolId];
        uint256 len = p.taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.assignee != address(0)) return true;
        }
        return false;
    }
}

