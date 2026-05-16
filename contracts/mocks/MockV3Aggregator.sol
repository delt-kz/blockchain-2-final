// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";

contract MockV3Aggregator is IAggregatorV3 {
    uint8 public immutable override decimals;
    string public override description;
    uint256 public immutable override version = 1;

    uint80 private _roundId;
    int256 private _answer;
    uint256 private _startedAt;
    uint256 private _updatedAt;
    uint80 private _answeredInRound;

    constructor(uint8 decimals_, int256 initialAnswer, string memory description_) {
        decimals = decimals_;
        description = description_;
        updateAnswer(initialAnswer);
    }

    function updateAnswer(int256 newAnswer) public {
        _roundId++;
        _answer = newAnswer;
        _startedAt = block.timestamp;
        _updatedAt = block.timestamp;
        _answeredInRound = _roundId;
    }

    function setStaleAnswer(int256 newAnswer, uint256 updatedAt) external {
        _roundId++;
        _answer = newAnswer;
        _startedAt = updatedAt;
        _updatedAt = updatedAt;
        _answeredInRound = _roundId;
    }

    function latestRoundData()
        external
        view
        override
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (_roundId, _answer, _startedAt, _updatedAt, _answeredInRound);
    }
}
