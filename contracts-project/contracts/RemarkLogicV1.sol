// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice 备注上链逻辑合约（正式版 v1）
///
/// ### 这个合约解决什么问题？
/// - 你的业务里，接包者在「提交凭证」时会写一句话，发包者在「审核通过」时会写一句话。
/// - 这两段话由链下收集后，在审核通过触发链上交易时，作为“不可篡改的存证”写入区块链。
/// - 本合约只负责“把两段文字与某个子任务绑定并上链”，不负责资金结算（那由 TaskPool 合约负责）。
///
/// ### 为什么用 (poolId, taskId) 作为 key（uint256）？
/// - TaskPool 侧的标识本身就是 `uint256 poolId / uint256 taskId`（由链下 UUID keccak 得到）。
/// - 链上统一使用 uint256，避免 string 编码差异（空格/大小写/UTF-8 等）导致的潜在不一致。
/// - 为防跨池冲突，本合约以 `(poolId, taskId)` 组合为唯一定位，并在内部打包为 bytes32 key：
///   `key = keccak256(abi.encodePacked(poolId, taskId))`
///
/// ### 与 Proxy（可升级代理）的关系
/// - 本合约作为 implementation 通过 Proxy `delegatecall` 使用。
contract RemarkLogicV1 {
    /// @dev 备注存储：key -> 接包者提交凭证时的那句话
    mapping(bytes32 => string) public senderRemarks;
    /// @dev 备注存储：key -> 发包者审核通过时的那句话
    mapping(bytes32 => string) public receiverRemarks;
    /// @dev 备注写入时间戳：key -> 最近一次写入时间（0 表示尚未写入）
    mapping(bytes32 => uint256) public remarkTimestamps;

    /// @notice 备注写入事件（便于链下检索与展示）
    /// @dev poolId/taskId 设置为 indexed，方便按子任务过滤日志。
    event RemarkSaved(
        uint256 indexed poolId,
        uint256 indexed taskId,
        string senderRemark,
        string receiverRemark,
        uint256 timestamp
    );

    /// @notice 写入一对子任务备注（接包者一句 + 发包者一句）
    /// @dev 开放写入：任何地址均可写；同一 key 会被覆盖写入（以最后一次写为准）。
    function saveRemark(
        uint256 poolId,
        uint256 taskId,
        string calldata senderRemark,
        string calldata receiverRemark
    ) external {
        // 将 (poolId, taskId) 组合成唯一 key；存储层使用 bytes32 key 作为映射键，便于高效索引。
        bytes32 key = keccak256(abi.encodePacked(poolId, taskId));
        senderRemarks[key] = senderRemark;
        receiverRemarks[key] = receiverRemark;
        remarkTimestamps[key] = block.timestamp;
        emit RemarkSaved(poolId, taskId, senderRemark, receiverRemark, block.timestamp);
    }

    /// @notice 查询某个子任务的两段备注与写入时间
    function getRemarks(uint256 poolId, uint256 taskId)
        external
        view
        returns (string memory senderRemark, string memory receiverRemark, uint256 timestamp)
    {
        bytes32 key = keccak256(abi.encodePacked(poolId, taskId));
        return (senderRemarks[key], receiverRemarks[key], remarkTimestamps[key]);
    }
}

