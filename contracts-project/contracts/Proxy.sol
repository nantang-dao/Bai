// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Proxy {
    // EIP-1967 标准槽位（字面量，assembly 中可用）
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant ADMIN_SLOT =
        0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;
    /// @dev 与 EIP-1967 槽位隔离的自定义槽 = keccak256(bytes("bai.proxy.pendingAdmin"))（assembly 需字面量）
    bytes32 private constant PENDING_ADMIN_SLOT =
        0x569b0068ae2ecb39ec05621b48281ad4eb042165536c00c657bc6166646c725c;

    error NotAdmin();
    error InvalidPendingAdmin();

    event AdminTransferProposed(address indexed proposedAdmin);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    constructor(address _implementation, address _admin) {
        assembly {
            sstore(IMPLEMENTATION_SLOT, _implementation)
            sstore(ADMIN_SLOT, _admin)
        }
    }

    modifier onlyAdmin() {
        address current;
        assembly {
            current := sload(ADMIN_SLOT)
        }
        if (msg.sender != current) revert NotAdmin();
        _;
    }

    /// @notice 当前 admin（可升级实现、提议下一任 admin）
    function admin() external view returns (address a) {
        assembly {
            a := sload(ADMIN_SLOT)
        }
    }

    /// @notice 待接任的 admin；为 address(0) 表示当前无待接受提议
    function pendingAdmin() external view returns (address p) {
        assembly {
            p := sload(PENDING_ADMIN_SLOT)
        }
    }

    /// @notice 第一步：由当前 admin 提议下一任 admin
    /// @param newPendingAdmin 新 admin 地址；传 address(0) 表示撤销当前提议
    function proposeAdmin(address newPendingAdmin) external onlyAdmin {
        assembly {
            sstore(PENDING_ADMIN_SLOT, newPendingAdmin)
        }
        emit AdminTransferProposed(newPendingAdmin);
    }

    /// @notice 第二步：由被提议地址调用，接受并成为 admin
    function acceptAdmin() external {
        address pending;
        assembly {
            pending := sload(PENDING_ADMIN_SLOT)
        }
        if (pending == address(0)) revert InvalidPendingAdmin();
        if (msg.sender != pending) revert InvalidPendingAdmin();

        address previous;
        assembly {
            previous := sload(ADMIN_SLOT)
            sstore(ADMIN_SLOT, pending)
            sstore(PENDING_ADMIN_SLOT, 0)
        }
        emit AdminTransferred(previous, pending);
    }

    function upgradeTo(address _newImplementation) external onlyAdmin {
        assembly {
            sstore(IMPLEMENTATION_SLOT, _newImplementation)
        }
    }

    function implementation() external view returns (address impl) {
        assembly {
            impl := sload(IMPLEMENTATION_SLOT)
        }
    }

    fallback() external payable {
        address impl;
        assembly {
            impl := sload(IMPLEMENTATION_SLOT)
        }
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {}
}
