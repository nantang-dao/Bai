// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Legacy remark logic contract (deprecated).
/// This file preserves the original V1 implementation for reference only.
/// Do NOT deploy for new environments.
contract LogicV1 {
    address public owner;
    mapping(bytes32 => string) public senderRemarks;
    mapping(bytes32 => string) public receiverRemarks;
    mapping(bytes32 => uint256) public remarkTimestamps;

    event RemarkSaved(string indexed taskId, string senderRemark, string receiverRemark, uint256 timestamp);

    error AlreadyInitialized();
    error NotOwner();
    error AlreadySet();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    function initialize(address _owner) external {
        if (owner != address(0)) revert AlreadyInitialized();
        owner = _owner;
    }

    function saveRemark(
        string calldata taskId,
        string calldata senderRemark,
        string calldata receiverRemark
    ) external {
        bytes32 taskIdHash = keccak256(abi.encodePacked(taskId));
        if (remarkTimestamps[taskIdHash] != 0) revert AlreadySet();
        senderRemarks[taskIdHash] = senderRemark;
        receiverRemarks[taskIdHash] = receiverRemark;
        remarkTimestamps[taskIdHash] = block.timestamp;
        emit RemarkSaved(taskId, senderRemark, receiverRemark, block.timestamp);
    }

    function getRemarks(string calldata taskId)
        external
        view
        returns (string memory senderRemark, string memory receiverRemark, uint256 timestamp)
    {
        bytes32 taskIdHash = keccak256(abi.encodePacked(taskId));
        return (senderRemarks[taskIdHash], receiverRemarks[taskIdHash], remarkTimestamps[taskIdHash]);
    }
}

