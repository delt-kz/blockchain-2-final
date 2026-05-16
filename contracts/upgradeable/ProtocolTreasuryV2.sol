// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ProtocolTreasury} from "./ProtocolTreasury.sol";

contract ProtocolTreasuryV2 is ProtocolTreasury {
    event TreasuryV2Ping(address indexed caller);

    function version() public pure override returns (string memory) {
        return "2.0.0";
    }

    function pingV2() external {
        emit TreasuryV2Ping(msg.sender);
    }
}
