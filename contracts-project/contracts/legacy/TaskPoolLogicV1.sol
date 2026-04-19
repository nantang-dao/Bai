// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
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

/// @notice 预付质押任务池逻辑合约（通过 Proxy 使用）
/// - 使用 NT 作为积分（标准 ERC20）
/// - 采用可升级代理，状态需保持稳定布局
///
/// 【一套合约两种用法】
/// - 毕设：任务包 + 全等式结算 + 防恶意拒收保证金 + 仲裁。建池时 unitPenaltyDeposit > 0，锁奖励+保证金。
/// - 社区：大任务拆小任务 + 全等式结算，不需要仲裁。建池时 unitPenaltyDeposit = 0，只锁任务奖励。
/// 是否要保证金由后端根据业务判断后传参，合约不区分场景，仅根据 unitPenaltyDeposit 是否为 0 决定是否锁定保证金。
contract TaskPoolLogicV1 {
    // ========= EIP-712 (Typed Data) =========
    // Domain is fixed to avoid "口径不一致" between frontend signing and contract hashing.
    string public constant EIP712_NAME = "TaskPool";
    string public constant EIP712_VERSION = "2";
    bytes32 private constant _EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant _CREATE_POOL_TYPEHASH =
        keccak256(
            "CreateTaskPool(uint256 poolId,address publisher,address manager,bytes32 taskIdsHash,bytes32 weightsHash,uint256 lockedReward,uint256 claimDeadline,uint256 unitPenaltyDeposit,uint256 nonce,uint256 sigDeadline)"
        );

    struct CreatePoolSigParams {
        uint256 poolId;
        address publisher;
        address manager;
        bytes32 taskIdsHash;
        bytes32 weightsHash;
        uint256 lockedReward;
        uint256 claimDeadline;
        uint256 unitPenaltyDeposit;
        uint256 nonce;
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
                p.weightsHash,
                p.lockedReward,
                p.claimDeadline,
                p.unitPenaltyDeposit,
                p.nonce,
                p.sigDeadline
            )
        );
        return _hashTypedDataV4(structHash);
    }

    /// =========================
    /// 存储布局（Proxy 关键）
    /// =========================
    /// 本合约通过可升级代理使用：下面这些 state 变量的声明顺序=存储槽布局。
    /// 后续升级时只能“在末尾追加变量”，不要调整/插入/删除已有变量，否则会造成存储错位。

    IERC20 public pointToken;          // NT 积分合约
    address public admin;              // 平台/管理地址（用于权限控制，如标记完成、设置仲裁合约等）
    address public arbitrationContract;// 仲裁合约地址（仅其可调用仲裁执行接口）
    address public remarkProxy;        // 备注合约 Proxy 地址（仅 TaskPool Proxy 为其 owner 时可写；未设置则不调用）
    bool private _initialized;

    /// =========================
    /// 预付余额账户（credit）
    /// =========================
    /// Publisher 先 deposit 充值到合约形成预付余额；创建任务池时不再从钱包扣款，
    /// 而是从 credit[publisher] 内部划拨到 pool 锁定资金（lockedReward + 可选保证金）。
    /// withdraw 仅允许提现“未锁定余额”（即 credit 余额本身）。
    mapping(address => uint256) public credit;

    /// =========================
    /// ID 约定（链下/链上对齐）
    /// =========================
    /// - poolId / taskId 均为 uint256，建议由后端用链下 id（如 UUID）派生：
    ///   poolId = uint256(keccak256(abi.encodePacked(task_info_id)))
    ///   taskId = uint256(keccak256(abi.encodePacked(task_row_id)))
    /// - 同一链下 id 始终映射到同一链上 id，便于前后端与事件索引对齐。

    struct Task {
        uint256 weight;        // 当前锁定权重（整数，万分之一精度）
        address assignee;      // 领取人（0 表示未领取）
        bool completed;        // 是否标记完成
        bool withdrawn;        // 是否作为「未领取子任务」被撤回 / 作废
        bool abandoned;        // 是否作为「已领取未完成子任务」被放弃
        bool exists;           // 是否存在
    }

    struct Pool {
        address publisher;           // 发布者（出资者/审核者）
        address manager;             // 领取大任务者（运营者：拆解/过期处理/回池等；不具备审核权）
        uint256 lockedReward;        // 任务池锁定奖励资金（来自 credit[publisher]）
        uint256 claimDeadline;       // 领取截止时间（用于 claimTask 以及「撤回未领取子任务」）
        uint256 unitPenaltyDeposit;  // 单个子任务防恶意拒收保证金单价；0 表示本池不启用保证金/仲裁
        uint256 totalPenaltyDeposit; // 保证金总额 = 单价 × 子任务数；为 0 时无仲裁扣款
        uint256[] taskIds;           // 子任务 ID 列表
        bool settled;                // 是否已完成最终结算/关闭
        bool withdrawnAll;           // 是否已整包撤回
        bool exists;                 // 任务池是否存在
    }

    /// =========================
    /// 核心状态存储（链上“数据库”）
    /// =========================
    /// pools：一个 poolId 对应一个任务池（大任务/任务包）
    /// poolTasks：一个 (poolId, taskId) 对应一个子任务状态
    /// 设计上让读写按 id O(1) 定位，避免遍历大数组带来的 gas 不确定性。
    mapping(uint256 => Pool) public pools;                     // poolId -> Pool
    mapping(uint256 => mapping(uint256 => Task)) public poolTasks; // poolId -> taskId -> Task

    event Initialized(address pointToken, address admin);
    event ArbitrationContractSet(address arbitration);
    event RemarkProxySet(address remarkProxy);

    event Deposited(address indexed publisher, uint256 amount);
    event Withdrawn(address indexed publisher, uint256 amount);

    event PoolCreated(
        uint256 indexed poolId,
        address indexed publisher,
        address indexed manager,
        uint256 lockedReward,
        uint256 claimDeadline,
        uint256 unitPenaltyDeposit,
        uint256 totalPenaltyDeposit
    );

    event TaskClaimed(
        uint256 indexed poolId,
        uint256 indexed taskId,
        address indexed assignee,
        uint256 weight
    );

    event TaskCompleted(
        uint256 indexed poolId,
        uint256 indexed taskId,
        address indexed assignee,
        string completionProofURI
    );

    event PoolSettled(uint256 indexed poolId);
    event PoolWithdrawnAll(uint256 indexed poolId);
    event TaskWithdrawn(uint256 indexed poolId, uint256 indexed taskId);
    event TaskAbandoned(uint256 indexed poolId, uint256 indexed taskId);
    event TaskReleased(
        uint256 indexed poolId,
        uint256 indexed taskId,
        uint256 newClaimDeadline
    );

    event ArbitrationExecuted(
        uint256 indexed poolId,
        uint256 indexed taskId,
        uint256 penaltyUsed,
        address to
    );

    error NotAdmin();
    error NotPublisher();
    error NotManager();
    error NotArbitration();
    error NotPublisherOrAdmin();
    error NotManagerOrAdmin();
    error BadSigner();
    error SignatureExpired();
    error InsufficientCredit();
    error BadNonce();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
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

    /// @notice 仅发布者或平台 admin 可操作（审核/标记完成）
    modifier onlyPublisherOrAdmin(uint256 poolId) {
        if (msg.sender != pools[poolId].publisher && msg.sender != admin) revert NotPublisherOrAdmin();
        _;
    }

    /// @notice 仅运营者（manager）或平台 admin 可操作（撤回/作废/回池/重设截止等运营）
    modifier onlyManagerOrAdmin(uint256 poolId) {
        if (msg.sender != pools[poolId].manager && msg.sender != admin) revert NotManagerOrAdmin();
        _;
    }

    modifier onlyArbitration() {
        if (msg.sender != arbitrationContract) revert NotArbitration();
        _;
    }

    modifier poolExists(uint256 poolId) {
        require(pools[poolId].exists, "POOL_NOT_EXISTS");
        _;
    }

    // ========= 初始化 =========

    /// @notice 通过 Proxy 初始化逻辑合约
    /// @param _pointToken NT 积分合约地址（ERC20）
    /// @param _admin 平台/管理地址
    function initialize(address _pointToken, address _admin) external {
        require(!_initialized, "ALREADY_INIT");
        require(_pointToken != address(0), "ZERO_TOKEN");
        require(_admin != address(0), "ZERO_ADMIN");
        pointToken = IERC20(_pointToken);
        admin = _admin;
        _initialized = true;
        emit Initialized(_pointToken, _admin);
    }

    function setArbitrationContract(address _arbitration) external onlyAdmin {
        arbitrationContract = _arbitration;
        emit ArbitrationContractSet(_arbitration);
    }

    function setRemarkProxy(address _remarkProxy) external onlyAdmin {
        remarkProxy = _remarkProxy;
        emit RemarkProxySet(_remarkProxy);
    }

    // ========= 预付余额账户 =========

    /// @notice Publisher 充值预付余额（可提现未锁定部分）
    function deposit(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");
        require(pointToken.transferFrom(msg.sender, address(this), amount), "TRANSFER_FAILED");
        credit[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice 提现未锁定余额（credit）
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

    // ========= 创建任务池 =========

    /// @notice 创建任务池（从 Publisher 的 credit 划拨锁款），由 Manager 发起
    /// - Publisher 只需先 deposit 充值到 credit，并对建池参数签名授权；无需亲自发链上建池交易
    /// - Manager 负责推进运营：提交签名并创建池（拆解则多个 taskIds；不拆则仅 1 个 taskId）
    /// - unitPenaltyDeposit=0 代表不启用保证金/仲裁（社区）；>0 则启用（毕设）
    function createTaskPool(
        uint256 poolId,
        address publisher,
        uint256[] calldata taskIds,
        uint256[] calldata weights,
        uint256 lockedReward,
        uint256 claimDeadline,
        uint256 unitPenaltyDeposit,
        uint256 nonce,
        uint256 sigDeadline,
        bytes calldata signature
    ) external {
        require(!pools[poolId].exists, "POOL_EXISTS");
        require(publisher != address(0), "ZERO_PUBLISHER");
        require(taskIds.length > 0, "NO_TASKS");
        require(taskIds.length == weights.length, "LENGTH_MISMATCH");
        require(lockedReward > 0, "ZERO_REWARD");
        // unitPenaltyDeposit 允许为 0：社区等不需要仲裁时只锁任务奖励，不锁保证金
        uint256 taskCount = taskIds.length;
        uint256 totalPenalty = unitPenaltyDeposit * taskCount;
        if (block.timestamp > sigDeadline) revert SignatureExpired();

        // Publisher 授权 Manager（msg.sender）按指定参数建池，并从其 credit 划拨锁款。
        // - 签名采用 EIP-712 typed data（避免 eth_sign 口径不一致）
        // - 验签采用 EIP-1271（兼容 Semi Safe 等合约账户）+ ECDSA（兼容 EOA）
        bytes32 taskIdsHash = keccak256(abi.encodePacked(taskIds));
        bytes32 weightsHash = keccak256(abi.encodePacked(weights));
        bytes32 digest = _hashCreatePoolTypedData(
            CreatePoolSigParams({
                poolId: poolId,
                publisher: publisher,
                manager: msg.sender,
                taskIdsHash: taskIdsHash,
                weightsHash: weightsHash,
                lockedReward: lockedReward,
                claimDeadline: claimDeadline,
                unitPenaltyDeposit: unitPenaltyDeposit,
                nonce: nonce,
                sigDeadline: sigDeadline
            })
        );
        if (!SignatureChecker.isValidSignatureNow(publisher, digest, signature)) revert BadSigner();

        // 防重放：用 creditNonces[publisher] 线性增长
        // 为保持存储布局最小变更，这里复用 credit[publisher] 之外新增 mapping 存 nonce（见文件末尾变量追加）
        if (creditNonces[publisher] != nonce) revert BadNonce();
        unchecked {
            creditNonces[publisher] = nonce + 1;
        }

        uint256 need = lockedReward + totalPenalty;
        uint256 bal = credit[publisher];
        if (bal < need) revert InsufficientCredit();
        unchecked {
            credit[publisher] = bal - need;
        }

        Pool storage p = pools[poolId];
        p.publisher = publisher;
        p.manager = msg.sender;
        p.lockedReward = lockedReward;
        p.claimDeadline = claimDeadline;
        p.unitPenaltyDeposit = unitPenaltyDeposit;
        p.totalPenaltyDeposit = totalPenalty;
        p.taskIds = taskIds;
        p.exists = true;

        for (uint256 i = 0; i < taskCount; i++) {
            uint256 taskId = taskIds[i];
            require(!poolTasks[poolId][taskId].exists, "TASK_DUP");
            require(weights[i] > 0, "ZERO_WEIGHT");
            poolTasks[poolId][taskId] = Task({
                weight: weights[i],
                assignee: address(0),
                completed: false,
                withdrawn: false,
                abandoned: false,
                exists: true
            });
        }

        emit PoolCreated(
            poolId,
            publisher,
            msg.sender,
            lockedReward,
            claimDeadline,
            unitPenaltyDeposit,
            totalPenalty
        );
    }

    // ========= 领取任务 =========

    function claimTask(
        uint256 poolId,
        uint256 taskId,
        uint256 newWeight
    ) external poolExists(poolId) {
        Pool storage p = pools[poolId];
        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(!p.withdrawnAll && !p.settled, "POOL_CLOSED");
        require(!t.withdrawn, "TASK_WITHDRAWN");
        require(t.assignee == address(0), "ALREADY_CLAIMED");
        require(block.timestamp <= p.claimDeadline, "DEADLINE_PASSED");
        require(newWeight > 0, "ZERO_WEIGHT");

        t.assignee = msg.sender;
        t.weight = newWeight;

        emit TaskClaimed(poolId, taskId, msg.sender, newWeight);
    }

    // ========= 标记完成 =========

    /// @notice 标记子任务完成（通常由平台钱包 / 后端授权地址调用），并可选写入接包者/发包者备注
    /// @param senderRemark 接包者提交凭证时的备注（若已配置 remarkProxy 则写入链上）
    /// @param receiverRemark 发包者审核通过时的备注（若已配置 remarkProxy 则写入链上）
    function markTaskCompleted(
        uint256 poolId,
        uint256 taskId,
        string calldata completionProofURI,
        string calldata senderRemark,
        string calldata receiverRemark
    ) external poolExists(poolId) onlyPublisherOrAdmin(poolId) {
        Pool storage p = pools[poolId];
        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(!p.withdrawnAll && !p.settled, "POOL_CLOSED");
        require(!t.withdrawn && !t.abandoned, "TASK_CLOSED");
        require(t.assignee != address(0), "NOT_CLAIMED");
        require(!t.completed, "ALREADY_COMPLETED");

        t.completed = true;

        if (remarkProxy != address(0)) {
            IRemark(remarkProxy).saveRemark(poolId, taskId, senderRemark, receiverRemark);
        }

        emit TaskCompleted(poolId, taskId, t.assignee, completionProofURI);

        if (_allEffectiveTasksCompleted(p, poolId)) {
            _settlePool(poolId);
        }
    }

    // ========= 整包撤回（全部未领取） =========

    function withdrawPool(uint256 poolId)
        external
        poolExists(poolId)
        onlyManagerOrAdmin(poolId)
    {
        Pool storage p = pools[poolId];
        require(!p.withdrawnAll && !p.settled, "POOL_CLOSED");
        require(_allTasksUnclaimed(poolId), "HAS_CLAIMED");

        uint256 total = p.lockedReward + p.totalPenaltyDeposit;

        p.withdrawnAll = true;
        p.settled = true;

        credit[p.publisher] += total;
        emit PoolWithdrawnAll(poolId);
    }

    // ========= 撤回单个未领取子任务（作废） =========

    function withdrawUnclaimedTask(uint256 poolId, uint256 taskId)
        external
        poolExists(poolId)
        onlyManagerOrAdmin(poolId)
    {
        Pool storage p = pools[poolId];
        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(!p.withdrawnAll && !p.settled, "POOL_CLOSED");
        require(!t.withdrawn && !t.abandoned && !t.completed, "TASK_CLOSED");
        require(t.assignee == address(0), "ALREADY_CLAIMED");
        require(block.timestamp > p.claimDeadline, "DEADLINE_NOT_PASSED");

        uint256 rewardForClaimedTasks = _settleRewardForClaimedTasks(poolId);
        uint256 remainingReward = p.lockedReward - rewardForClaimedTasks;
        if (remainingReward > 0) {
            credit[p.publisher] += remainingReward;
        }

        if (p.unitPenaltyDeposit > 0) {
            credit[p.publisher] += p.unitPenaltyDeposit;
        }
        p.totalPenaltyDeposit -= p.unitPenaltyDeposit;

        t.withdrawn = true;

        emit TaskWithdrawn(poolId, taskId);

        if (_allEffectiveTasksClosed(poolId)) {
            p.settled = true;
            emit PoolSettled(poolId);
        }
    }

    // ========= 放弃已领取但未完成的子任务 =========

    function abandonTask(uint256 poolId, uint256 taskId)
        external
        poolExists(poolId)
        onlyManagerOrAdmin(poolId)
    {
        Pool storage p = pools[poolId];
        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(!p.withdrawnAll && !p.settled, "POOL_CLOSED");
        require(!t.withdrawn && !t.abandoned && !t.completed, "TASK_CLOSED");
        require(t.assignee != address(0), "NOT_CLAIMED");

        t.abandoned = true;

        uint256 rewardForCompleted = _settleRewardForCompletedTasks(poolId);

        uint256 remainingReward = p.lockedReward - rewardForCompleted;
        if (remainingReward > 0) {
            credit[p.publisher] += remainingReward;
        }

        emit TaskAbandoned(poolId, taskId);

        if (_allEffectiveTasksClosed(poolId)) {
            p.settled = true;
            emit PoolSettled(poolId);
        }
    }

    // ========= 任务回池（已领但未交凭证，防死锁） =========

    function releaseTaskAndSetDeadline(
        uint256 poolId,
        uint256 taskId,
        uint256 newClaimDeadline
    ) external poolExists(poolId) onlyManagerOrAdmin(poolId) {
        Pool storage p = pools[poolId];
        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(!p.withdrawnAll && !p.settled, "POOL_CLOSED");
        require(!t.withdrawn && !t.completed && !t.abandoned, "TASK_CLOSED");
        require(t.assignee != address(0), "NOT_CLAIMED");
        require(newClaimDeadline > block.timestamp, "BAD_DEADLINE");

        t.assignee = address(0);
        p.claimDeadline = newClaimDeadline;

        emit TaskReleased(poolId, taskId, newClaimDeadline);
    }

    // ========= 仲裁预留接口 =========

    function executeArbitrationResult(
        uint256 poolId,
        uint256 taskId,
        uint256 amount,
        address to
    ) external poolExists(poolId) onlyArbitration {
        Pool storage p = pools[poolId];
        Task storage t = poolTasks[poolId][taskId];
        require(t.exists, "TASK_NOT_EXISTS");
        require(amount > 0, "ZERO_AMOUNT");
        require(to != address(0), "ZERO_TO");
        require(amount <= p.totalPenaltyDeposit, "EXCEED_TOTAL_PENALTY");

        p.totalPenaltyDeposit -= amount;
        require(pointToken.transfer(to, amount), "TRANSFER_FAILED");

        emit ArbitrationExecuted(poolId, taskId, amount, to);
    }

    // ========= 内部工具函数 =========

    function _allEffectiveTasksCompleted(Pool storage p, uint256 poolId)
        internal
        view
        returns (bool)
    {
        uint256 len = p.taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.withdrawn || t.abandoned) continue;
            if (!t.completed) return false;
        }
        return true;
    }

    function _allTasksUnclaimed(uint256 poolId)
        internal
        view
        returns (bool)
    {
        Pool storage p = pools[poolId];
        uint256 len = p.taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (t.assignee != address(0)) {
                return false;
            }
        }
        return true;
    }

    function _allEffectiveTasksClosed(uint256 poolId)
        internal
        view
        returns (bool)
    {
        Pool storage p = pools[poolId];
        uint256 len = p.taskIds.length;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (!t.completed && !t.withdrawn && !t.abandoned) {
                return false;
            }
        }
        return true;
    }

    function _settlePool(uint256 poolId) internal {
        Pool storage p = pools[poolId];
        require(!p.settled, "ALREADY_SETTLED");

        uint256 len = p.taskIds.length;
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.withdrawn || t.abandoned) continue;
            require(t.completed, "INCOMPLETE_TASK");
            totalWeight += t.weight;
        }
        require(totalWeight > 0, "ZERO_TOTAL_WEIGHT");

        uint256 distributed = 0;

        for (uint256 i = 0; i < len; i++) {
            uint256 taskId = p.taskIds[i];
            Task storage t = poolTasks[poolId][taskId];
            if (!t.exists) continue;
            if (t.withdrawn || t.abandoned) continue;

            uint256 share = (p.lockedReward * t.weight) / totalWeight;
            if (share > 0) {
                distributed += share;
                require(
                    pointToken.transfer(t.assignee, share),
                    "TRANSFER_FAILED"
                );
            }
        }

        uint256 residue = p.lockedReward - distributed;
        if (residue > 0) {
            credit[p.publisher] += residue;
        }

        p.settled = true;
        emit PoolSettled(poolId);
    }

    function _settleRewardForClaimedTasks(uint256 poolId)
        internal
        returns (uint256 distributed)
    {
        Pool storage p = pools[poolId];

        uint256 len = p.taskIds.length;
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.assignee != address(0)) {
                totalWeight += t.weight;
            }
        }
        if (totalWeight == 0) {
            return 0;
        }

        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.assignee == address(0)) continue;

            uint256 share = (p.lockedReward * t.weight) / totalWeight;
            if (share > 0) {
                distributed += share;
                require(
                    pointToken.transfer(t.assignee, share),
                    "TRANSFER_FAILED"
                );
            }
        }
    }

    function _settleRewardForCompletedTasks(uint256 poolId)
        internal
        returns (uint256 distributed)
    {
        Pool storage p = pools[poolId];
        uint256 len = p.taskIds.length;
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (t.completed) {
                totalWeight += t.weight;
            }
        }
        if (totalWeight == 0) {
            return 0;
        }

        for (uint256 i = 0; i < len; i++) {
            Task storage t = poolTasks[poolId][p.taskIds[i]];
            if (!t.exists) continue;
            if (!t.completed) continue;

            uint256 share = (p.lockedReward * t.weight) / totalWeight;
            if (share > 0) {
                distributed += share;
                require(
                    pointToken.transfer(t.assignee, share),
                    "TRANSFER_FAILED"
                );
            }
        }
    }

    // ========= V2 nonce（末尾追加，避免存储错位） =========

    /// @dev Publisher 的签名 nonce，用于防重放；每成功建池一次 nonce++。
    mapping(address => uint256) public creditNonces;
}

