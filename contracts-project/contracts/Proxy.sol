// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Proxy {
    // EIP-1967 标准槽位（字面量，assembly 中可用）
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant ADMIN_SLOT =
        0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    error NotAdmin();

    constructor(address _implementation, address _admin) {
        assembly {
            sstore(IMPLEMENTATION_SLOT, _implementation)
            sstore(ADMIN_SLOT, _admin)
        }
    }

    modifier onlyAdmin() {
        address admin;
        assembly {
            admin := sload(ADMIN_SLOT)
        }
        if (msg.sender != admin) revert NotAdmin();
        _;
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