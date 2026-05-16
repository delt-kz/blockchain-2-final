// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAggregatorV3} from "../interfaces/IAggregatorV3.sol";

contract ChainlinkPriceOracle is Ownable {
    struct FeedConfig {
        IAggregatorV3 feed;
        uint48 staleAfter;
        bool enabled;
    }

    mapping(address asset => FeedConfig config) private _feeds;

    event FeedSet(address indexed asset, address indexed feed, uint48 staleAfter);
    event FeedRemoved(address indexed asset);

    error FeedNotSet(address asset);
    error InvalidFeed();
    error InvalidPrice();
    error StalePrice(address asset, uint256 updatedAt, uint256 staleAfter);
    error RoundIncomplete();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setFeed(address asset, address feed, uint48 staleAfter) external onlyOwner {
        if (asset == address(0) || feed == address(0) || staleAfter == 0) revert InvalidFeed();
        _feeds[asset] = FeedConfig({feed: IAggregatorV3(feed), staleAfter: staleAfter, enabled: true});
        emit FeedSet(asset, feed, staleAfter);
    }

    function removeFeed(address asset) external onlyOwner {
        delete _feeds[asset];
        emit FeedRemoved(asset);
    }

    function feedConfig(address asset) external view returns (address feed, uint48 staleAfter, bool enabled) {
        FeedConfig memory config = _feeds[asset];
        return (address(config.feed), config.staleAfter, config.enabled);
    }

    function getPrice(address asset) public view returns (uint256 price, uint8 decimals, uint256 updatedAt) {
        FeedConfig memory config = _feeds[asset];
        if (!config.enabled) revert FeedNotSet(asset);

        (uint80 roundId, int256 answer,, uint256 answerUpdatedAt, uint80 answeredInRound) =
            config.feed.latestRoundData();

        if (answeredInRound < roundId) revert RoundIncomplete();
        if (answer <= 0) revert InvalidPrice();
        if (answerUpdatedAt == 0 || block.timestamp - answerUpdatedAt > config.staleAfter) {
            revert StalePrice(asset, answerUpdatedAt, config.staleAfter);
        }

        return (uint256(answer), config.feed.decimals(), answerUpdatedAt);
    }

    function getPrice18(address asset) external view returns (uint256) {
        (uint256 price, uint8 decimals,) = getPrice(asset);
        if (decimals == 18) return price;
        if (decimals < 18) return price * (10 ** (18 - decimals));
        return price / (10 ** (decimals - 18));
    }
}
