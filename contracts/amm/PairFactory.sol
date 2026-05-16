// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {DefiSwapPair} from "./DefiSwapPair.sol";

contract PairFactory is Ownable {
    mapping(address token0 => mapping(address token1 => address pair)) public getPair;
    address[] public allPairs;
    address public feeRecipient;

    event PairCreated(
        address indexed token0, address indexed token1, address pair, bytes32 indexed salt, bool deterministic
    );
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    error IdenticalTokens();
    error ZeroAddress();
    error PairExists();

    constructor(address initialFeeRecipient, address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        feeRecipient = initialFeeRecipient == address(0) ? initialOwner : initialFeeRecipient;
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }

    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, newFeeRecipient);
        feeRecipient = newFeeRecipient;
    }

    function createPair(address tokenA, address tokenB) external onlyOwner returns (address pair) {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        if (getPair[token0][token1] != address(0)) revert PairExists();

        pair = address(new DefiSwapPair(token0, token1, feeRecipient, owner()));
        _registerPair(token0, token1, pair, bytes32(0), false);
    }

    function createPairDeterministic(address tokenA, address tokenB, bytes32 salt)
        external
        onlyOwner
        returns (address pair)
    {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        if (getPair[token0][token1] != address(0)) revert PairExists();

        bytes32 finalSalt = keccak256(abi.encodePacked(token0, token1, salt));
        pair = address(new DefiSwapPair{salt: finalSalt}(token0, token1, feeRecipient, owner()));
        _registerPair(token0, token1, pair, finalSalt, true);
    }

    function predictPairAddress(address tokenA, address tokenB, bytes32 salt)
        external
        view
        returns (address predicted)
    {
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        bytes32 finalSalt = keccak256(abi.encodePacked(token0, token1, salt));
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(type(DefiSwapPair).creationCode, abi.encode(token0, token1, feeRecipient, owner()))
        );
        predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), finalSalt, bytecodeHash))))
        );
    }

    function _registerPair(address token0, address token1, address pair, bytes32 salt, bool deterministic) private {
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair;
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, salt, deterministic);
    }

    function _sortTokens(address tokenA, address tokenB) private pure returns (address token0, address token1) {
        if (tokenA == tokenB) revert IdenticalTokens();
        if (tokenA == address(0) || tokenB == address(0)) revert ZeroAddress();
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
    }
}
