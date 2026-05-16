// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract DefiSwapPair is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    uint256 public constant FEE_BPS = 30;
    uint256 public constant BPS = 10_000;
    uint256 public constant MINIMUM_LIQUIDITY = 1_000;

    address public immutable token0;
    address public immutable token1;
    address public feeRecipient;

    uint112 private _reserve0;
    uint112 private _reserve1;

    event LiquidityAdded(address indexed provider, address indexed to, uint256 amount0, uint256 amount1, uint256 shares);
    event LiquidityRemoved(address indexed provider, address indexed to, uint256 amount0, uint256 amount1, uint256 shares);
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed to,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeAmount
    );
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event ReservesSynced(uint112 reserve0, uint112 reserve1);

    error IdenticalTokens();
    error ZeroAddress();
    error ZeroAmount();
    error InsufficientLiquidityMinted();
    error InsufficientLiquidityBurned();
    error InsufficientOutputAmount();
    error InsufficientInputAmount();
    error InvalidToken();
    error Overflow();

    constructor(address tokenA, address tokenB, address initialFeeRecipient, address initialOwner)
        ERC20("DeFi Student LP", "DS-LP")
        Ownable(initialOwner)
    {
        if (tokenA == tokenB) revert IdenticalTokens();
        if (tokenA == address(0) || tokenB == address(0) || initialOwner == address(0)) revert ZeroAddress();
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        feeRecipient = initialFeeRecipient == address(0) ? initialOwner : initialFeeRecipient;
    }

    function getReserves() external view returns (uint112 reserve0, uint112 reserve1) {
        return (_reserve0, _reserve1);
    }

    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        if (newFeeRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, newFeeRecipient);
        feeRecipient = newFeeRecipient;
    }

    function addLiquidity(uint256 amount0Desired, uint256 amount1Desired, uint256 minShares, address to)
        external
        nonReentrant
        returns (uint256 shares)
    {
        if (amount0Desired == 0 || amount1Desired == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        (uint112 reserve0, uint112 reserve1) = (_reserve0, _reserve1);
        IERC20(token0).safeTransferFrom(msg.sender, address(this), amount0Desired);
        IERC20(token1).safeTransferFrom(msg.sender, address(this), amount1Desired);

        uint256 supply = totalSupply();
        if (supply == 0) {
            shares = Math.sqrt(amount0Desired * amount1Desired);
            if (shares <= MINIMUM_LIQUIDITY) revert InsufficientLiquidityMinted();
            _mint(address(0xdead), MINIMUM_LIQUIDITY);
            shares -= MINIMUM_LIQUIDITY;
        } else {
            shares = Math.min((amount0Desired * supply) / reserve0, (amount1Desired * supply) / reserve1);
        }

        if (shares < minShares || shares == 0) revert InsufficientLiquidityMinted();
        _mint(to, shares);
        _updateReserves();

        emit LiquidityAdded(msg.sender, to, amount0Desired, amount1Desired, shares);
    }

    function removeLiquidity(uint256 shares, uint256 minAmount0, uint256 minAmount1, address to)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        if (shares == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 supply = totalSupply();
        amount0 = (shares * _reserve0) / supply;
        amount1 = (shares * _reserve1) / supply;
        if (amount0 < minAmount0 || amount1 < minAmount1 || amount0 == 0 || amount1 == 0) {
            revert InsufficientLiquidityBurned();
        }

        _burn(msg.sender, shares);
        _updateReservesAfter(_reserve0 - uint112(amount0), _reserve1 - uint112(amount1));

        IERC20(token0).safeTransfer(to, amount0);
        IERC20(token1).safeTransfer(to, amount1);

        emit LiquidityRemoved(msg.sender, to, amount0, amount1, shares);
    }

    function swapExactTokensForTokens(uint256 amountIn, uint256 minAmountOut, address tokenIn, address to)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        if (tokenIn != token0 && tokenIn != token1) revert InvalidToken();

        bool zeroForOne = tokenIn == token0;
        address tokenOut = zeroForOne ? token1 : token0;
        uint112 reserveIn = zeroForOne ? _reserve0 : _reserve1;
        uint112 reserveOut = zeroForOne ? _reserve1 : _reserve0;
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientOutputAmount();

        uint256 feeAmount = (amountIn * FEE_BPS) / BPS;
        amountOut = getAmountOut(amountIn, tokenIn);
        if (amountOut < minAmountOut || amountOut == 0) revert InsufficientOutputAmount();

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        uint256 protocolFee = feeAmount / 6;
        if (protocolFee > 0) {
            IERC20(tokenIn).safeTransfer(feeRecipient, protocolFee);
        }
        IERC20(tokenOut).safeTransfer(to, amountOut);

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        if (balance0 > type(uint112).max || balance1 > type(uint112).max) revert Overflow();
        _updateReservesAfter(uint112(balance0), uint112(balance1));

        emit Swap(msg.sender, tokenIn, to, amountIn, amountOut, feeAmount);
    }

    function getAmountOut(uint256 amountIn, address tokenIn) public view returns (uint256) {
        if (amountIn == 0) revert InsufficientInputAmount();
        if (tokenIn != token0 && tokenIn != token1) revert InvalidToken();

        bool zeroForOne = tokenIn == token0;
        uint256 reserveIn = zeroForOne ? _reserve0 : _reserve1;
        uint256 reserveOut = zeroForOne ? _reserve1 : _reserve0;
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientOutputAmount();

        uint256 amountInWithFee = amountIn * (BPS - FEE_BPS);
        return (reserveOut * amountInWithFee) / ((reserveIn * BPS) + amountInWithFee);
    }

    function sync() external nonReentrant {
        _updateReserves();
    }

    function _updateReserves() private {
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        if (balance0 > type(uint112).max || balance1 > type(uint112).max) revert Overflow();
        _updateReservesAfter(uint112(balance0), uint112(balance1));
    }

    function _updateReservesAfter(uint112 reserve0_, uint112 reserve1_) private {
        _reserve0 = reserve0_;
        _reserve1 = reserve1_;
        emit ReservesSynced(reserve0_, reserve1_);
    }
}
