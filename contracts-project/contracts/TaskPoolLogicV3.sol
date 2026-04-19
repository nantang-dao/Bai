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

/// @notice TaskPool V3（通过 Proxy 使用）
/// V3 变更要点（兼容 V2 存储布局）：
/// - 新增 `createTaskPoolSelf`：当 publisher=manager=msg.sender 时，可跳过 publisher 的 EIP-712 签名，便于 Semi 一次确认完成「approve→deposit→create」。
contract TaskPoolLogicV3 {
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
        Open,
        Completed,
        Cancelled,
        Expired
    }

    struct Task {
        address assignee;
        uint256 amount;
        uint256 maxAmount;
        uint256 claimNonce;
        TaskStatus status;
        bool exists;
    }

    struct Pool {
        address publisher;
        address manager;
        uint256 lockedBalance;
        uint256 allocated;
        uint256 claimDeadline;

        uint64 publicizeEligibleAt;
        uint64 publicizeEndsAt;
        bool paused;
        bool settled;

        uint256[] taskIds;
        bool exists;
        uint256 credentialDeadline;
        bool poolRejected;
    }

    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(uint256 => Task)) public poolTasks;

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
    /// @notice 由 manager 发起创建池；publisher 仅签名授权并在 credit 中预存
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

        _createPoolCore(poolId, publisher, msg.sender, taskIds, taskMaxAmounts, lockedBalance, claimDeadline, credentialDeadline);
    }

    /// @notice 自助建池（普通任务通道）：publisher=manager=msg.sender，无需 publisher 的 EIP-712 签名
    function createTaskPoolSelf(
        uint256 poolId,
        uint256[] calldata taskIds,
        uint256[] calldata taskMaxAmounts,
        uint256 lockedBalance,
        uint256 claimDeadline,
        uint256 credentialDeadline
    ) external {
        require(!pools[poolId].exists, "POOL_EXISTS");
        require(taskIds.length > 0, "NO_TASKS");
        require(taskIds.length == taskMaxAmounts.length, "LENGTH_MISMATCH");
        require(lockedBalance > 0, "ZERO_LOCK");
        require(credentialDeadline > claimDeadline, "BAD_CREDENTIAL_DEADLINE");

        // 维持与 V2 相同的 nonce 单调递增语义（无需签名，只作为链上幂等计数）
        unchecked {
            creditNonces[msg.sender] = creditNonces[msg.sender] + 1;
        }

        _createPoolCore(poolId, msg.sender, msg.sender, taskIds, taskMaxAmounts, lockedBalance, claimDeadline, credentialDeadline);
    }

    function _createPoolCore(
        uint256 poolId,
        address publisher,
        address manager,
        uint256[] calldata taskIds,
        uint256[] calldata taskMaxAmounts,
        uint256 lockedBalance,
        uint256 claimDeadline,
        uint256 credentialDeadline
    ) internal {
        uint256 bal = credit[publisher];
        if (bal < lockedBalance) revert InsufficientCredit();
        unchecked {
            credit[publisher] = bal - lockedBalance;
        }

        Pool storage p = pools[poolId];
        p.publisher = publisher;
        p.manager = manager;
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

        emit PoolCreated(poolId, publisher, manager, lockedBalance, claimDeadline, credentialDeadline);
    }

    // ========= Claim / amount management =========
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

    // ========= Subtask review (manager only) =========
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

    // ========= Cancel / expire (manager/admin ops) =========
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

    // ========= Final approve -> publicize window =========
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

    // ========= Distribute =========
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

    // ========= Helpers =========
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

