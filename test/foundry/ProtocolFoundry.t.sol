// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";
import {ProtocolGovernor} from "../../contracts/governance/ProtocolGovernor.sol";
import {DefiSwapPair} from "../../contracts/amm/DefiSwapPair.sol";
import {PairFactory} from "../../contracts/amm/PairFactory.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";
import {MockV3Aggregator} from "../../contracts/mocks/MockV3Aggregator.sol";
import {ChainlinkPriceOracle} from "../../contracts/oracle/ChainlinkPriceOracle.sol";
import {ProtocolProxy} from "../../contracts/proxy/ProtocolProxy.sol";
import {GovernanceToken} from "../../contracts/tokens/GovernanceToken.sol";
import {ProtocolItems} from "../../contracts/tokens/ProtocolItems.sol";
import {ProtocolTreasury} from "../../contracts/upgradeable/ProtocolTreasury.sol";
import {ProtocolTreasuryV2} from "../../contracts/upgradeable/ProtocolTreasuryV2.sol";
import {AssemblyMath} from "../../contracts/utils/AssemblyMath.sol";
import {YieldVault} from "../../contracts/vault/YieldVault.sol";

interface IAggregatorLike {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

interface IUniswapV2RouterLike {
    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts);
}

contract VulnerableNativeVault {
    mapping(address user => uint256 amount) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "no balance");
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "send failed");
        balances[msg.sender] = 0;
    }
}

contract ReentrancyAttacker {
    VulnerableNativeVault public immutable vault;
    uint256 public calls;

    constructor(VulnerableNativeVault vault_) {
        vault = vault_;
    }

    function attack() external payable {
        vault.deposit{value: msg.value}();
        vault.withdraw();
    }

    receive() external payable {
        calls++;
        if (address(vault).balance >= 1 ether && calls < 4) {
            vault.withdraw();
        }
    }
}

contract TreasuryReentryProbe {
    ProtocolTreasury public immutable treasury;
    uint256 public received;

    constructor(ProtocolTreasury treasury_) {
        treasury = treasury_;
    }

    receive() external payable {
        received += msg.value;
        try treasury.releaseNative(payable(address(this)), msg.value) {} catch {}
    }
}

contract VulnerableAdminRegistry {
    address public admin;

    constructor(address admin_) {
        admin = admin_;
    }

    function setAdmin(address newAdmin) external {
        admin = newAdmin;
    }
}

contract ProtocolFoundryBase is Test {
    address internal deployer = address(this);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal attacker = address(0xBAD);

    GovernanceToken internal governanceToken;
    TimelockController internal timelock;
    ProtocolGovernor internal governor;
    ProtocolTreasury internal treasury;
    ProtocolTreasury internal treasuryImpl;
    MockERC20 internal usdc;
    MockERC20 internal weth;
    MockERC20 internal dai;
    MockV3Aggregator internal ethFeed;
    ChainlinkPriceOracle internal oracle;
    YieldVault internal vault;
    ProtocolItems internal items;
    PairFactory internal factory;
    DefiSwapPair internal pair;
    AssemblyMath internal assemblyMath;

    receive() external payable {}

    function setUp() public virtual {
        vm.warp(10 days);
        vm.deal(deployer, 100 ether);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(attacker, 100 ether);

        governanceToken = new GovernanceToken(deployer);
        governanceToken.mint(deployer, 1_000_000 ether);
        governanceToken.mint(alice, 100_000 ether);
        governanceToken.delegate(deployer);

        timelock = new TimelockController(2 days, new address[](0), new address[](0), deployer);
        governor = new ProtocolGovernor(governanceToken, timelock, 10_000 ether);

        bytes memory initData = abi.encodeCall(ProtocolTreasury.initialize, (deployer));
        treasuryImpl = new ProtocolTreasury();
        treasury = ProtocolTreasury(payable(address(new ProtocolProxy(address(treasuryImpl), initData))));

        usdc = new MockERC20("Student USD", "sUSD", 6, deployer);
        weth = new MockERC20("Wrapped Student ETH", "sWETH", 18, deployer);
        dai = new MockERC20("Student DAI", "sDAI", 18, deployer);
        usdc.mint(deployer, 10_000_000 ether);
        weth.mint(deployer, 10_000_000 ether);
        dai.mint(deployer, 10_000_000 ether);
        usdc.mint(alice, 1_000_000 ether);
        weth.mint(alice, 1_000_000 ether);
        dai.mint(alice, 1_000_000 ether);
        usdc.mint(bob, 1_000_000 ether);
        weth.mint(bob, 1_000_000 ether);

        vault = new YieldVault(IERC20(address(usdc)), deployer);
        items = new ProtocolItems("ipfs://student/{id}.json", deployer);
        oracle = new ChainlinkPriceOracle(deployer);
        ethFeed = new MockV3Aggregator(8, 3000_00000000, "ETH / USD");
        oracle.setFeed(address(weth), address(ethFeed), 1 days);
        factory = new PairFactory(deployer, deployer);
        factory.createPair(address(usdc), address(weth));
        pair = DefiSwapPair(factory.getPair(address(usdc), address(weth)));
        assemblyMath = new AssemblyMath();
    }

    function _addPairLiquidity(uint256 amount0, uint256 amount1) internal {
        IERC20(pair.token0()).approve(address(pair), amount0);
        IERC20(pair.token1()).approve(address(pair), amount1);
        pair.addLiquidity(amount0, amount1, 1, deployer);
    }

    function _depositVault(address user, uint256 assets) internal {
        vm.startPrank(user);
        usdc.approve(address(vault), assets);
        vault.deposit(assets, user);
        vm.stopPrank();
    }

    function _fundTreasuryToken(uint256 amount) internal {
        usdc.approve(address(treasury), amount);
        treasury.depositToken(usdc, amount);
    }
}

contract ProtocolUnitTest is ProtocolFoundryBase {
    function test001GovernanceTokenMetadata() public {
        assertEq(governanceToken.name(), "DeFi Student Governance");
        assertEq(governanceToken.symbol(), "DSG");
        assertEq(governanceToken.decimals(), 18);
    }

    function test002GovernanceTokenOwnerCanMint() public {
        uint256 beforeSupply = governanceToken.totalSupply();
        governanceToken.mint(bob, 1 ether);
        assertEq(governanceToken.balanceOf(bob), 1 ether);
        assertEq(governanceToken.totalSupply(), beforeSupply + 1 ether);
    }

    function test003GovernanceTokenRejectsUnauthorizedMint() public {
        vm.prank(attacker);
        vm.expectRevert();
        governanceToken.mint(attacker, 1 ether);
    }

    function test004GovernanceTokenRejectsMaxSupplyExceeded() public {
        uint256 impossibleMint = governanceToken.MAX_SUPPLY();
        vm.expectRevert(GovernanceToken.MaxSupplyExceeded.selector);
        governanceToken.mint(bob, impossibleMint);
    }

    function test005GovernanceTokenClockUsesTimestampMode() public {
        vm.warp(123_456);
        assertEq(governanceToken.clock(), 123_456);
        assertEq(governanceToken.CLOCK_MODE(), "mode=timestamp");
    }

    function test006GovernanceTokenDelegationCreatesVotes() public {
        vm.prank(alice);
        governanceToken.delegate(alice);
        assertEq(governanceToken.getVotes(alice), governanceToken.balanceOf(alice));
    }

    function test007GovernanceTokenTransferMovesDelegatedVotes() public {
        vm.prank(alice);
        governanceToken.delegate(alice);
        uint256 beforeVotes = governanceToken.getVotes(alice);
        vm.prank(alice);
        governanceToken.transfer(bob, 100 ether);
        assertEq(governanceToken.getVotes(alice), beforeVotes - 100 ether);
    }

    function test008GovernanceTokenPermitNonceStartsAtZero() public {
        assertEq(governanceToken.nonces(alice), 0);
    }

    function test009GovernorParametersMatchSpec() public {
        assertEq(governor.votingDelay(), 1 days);
        assertEq(governor.votingPeriod(), 1 weeks);
        assertEq(governor.quorumNumerator(), 4);
        assertEq(governor.proposalThreshold(), 10_000 ether);
    }

    function test010TimelockDelayMatchesSpec() public {
        assertEq(timelock.getMinDelay(), 2 days);
    }

    function test011TreasuryInitialRoles() public {
        assertTrue(treasury.hasRole(treasury.DEFAULT_ADMIN_ROLE(), deployer));
        assertTrue(treasury.hasRole(treasury.TREASURER_ROLE(), deployer));
        assertTrue(treasury.hasRole(treasury.PAUSER_ROLE(), deployer));
        assertTrue(treasury.hasRole(treasury.UPGRADER_ROLE(), deployer));
    }

    function test012TreasuryRejectsZeroAdminInitialize() public {
        ProtocolTreasury impl = new ProtocolTreasury();
        vm.expectRevert();
        impl.initialize(address(0));
    }

    function test013TreasuryCannotInitializeTwice() public {
        vm.expectRevert();
        treasury.initialize(deployer);
    }

    function test014TreasuryReceivesNative() public {
        (bool ok,) = address(treasury).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(address(treasury).balance, 1 ether);
    }

    function test015TreasuryDepositsTokens() public {
        _fundTreasuryToken(100 ether);
        assertEq(usdc.balanceOf(address(treasury)), 100 ether);
    }

    function test016TreasuryRejectsZeroTokenDeposit() public {
        vm.expectRevert(ProtocolTreasury.ZeroAmount.selector);
        treasury.depositToken(usdc, 0);
    }

    function test017TreasuryRejectsZeroTokenAddressDeposit() public {
        vm.expectRevert(ProtocolTreasury.ZeroAddress.selector);
        treasury.depositToken(IERC20(address(0)), 1);
    }

    function test018TreasuryReleasesNativeWithCall() public {
        (bool ok,) = address(treasury).call{value: 2 ether}("");
        assertTrue(ok);
        treasury.releaseNative(payable(alice), 1 ether);
        assertEq(alice.balance, 101 ether);
    }

    function test019TreasuryRejectsUnauthorizedNativeRelease() public {
        vm.prank(attacker);
        vm.expectRevert();
        treasury.releaseNative(payable(attacker), 1 ether);
    }

    function test020TreasuryRejectsZeroNativeRelease() public {
        vm.expectRevert(ProtocolTreasury.ZeroAmount.selector);
        treasury.releaseNative(payable(alice), 0);
    }

    function test021TreasuryRejectsZeroNativeRecipient() public {
        vm.expectRevert(ProtocolTreasury.ZeroAddress.selector);
        treasury.releaseNative(payable(address(0)), 1);
    }

    function test022TreasuryReleasesTokens() public {
        _fundTreasuryToken(100 ether);
        treasury.releaseToken(usdc, alice, 40 ether);
        assertEq(usdc.balanceOf(alice), 1_000_040 ether);
    }

    function test023TreasuryRejectsUnauthorizedTokenRelease() public {
        vm.prank(attacker);
        vm.expectRevert();
        treasury.releaseToken(usdc, attacker, 1 ether);
    }

    function test024TreasuryPauseBlocksDeposits() public {
        treasury.pause();
        usdc.approve(address(treasury), 1 ether);
        vm.expectRevert();
        treasury.depositToken(usdc, 1 ether);
    }

    function test025TreasuryUnpauseRestoresDeposits() public {
        treasury.pause();
        treasury.unpause();
        _fundTreasuryToken(1 ether);
        assertEq(usdc.balanceOf(address(treasury)), 1 ether);
    }

    function test026TreasuryRejectsUnauthorizedPause() public {
        vm.prank(attacker);
        vm.expectRevert();
        treasury.pause();
    }

    function test027TreasuryUpgradesToV2() public {
        ProtocolTreasuryV2 v2 = new ProtocolTreasuryV2();
        treasury.upgradeToAndCall(address(v2), "");
        assertEq(ProtocolTreasuryV2(payable(address(treasury))).version(), "2.0.0");
    }

    function test028TreasuryRejectsUnauthorizedUpgrade() public {
        ProtocolTreasuryV2 v2 = new ProtocolTreasuryV2();
        vm.prank(attacker);
        vm.expectRevert();
        treasury.upgradeToAndCall(address(v2), "");
    }

    function test029FactoryMetadataAndLength() public {
        assertEq(factory.feeRecipient(), deployer);
        assertEq(factory.allPairsLength(), 1);
        assertEq(factory.allPairs(0), address(pair));
    }

    function test030FactoryCreatesNormalPair() public {
        PairFactory fresh = new PairFactory(deployer, deployer);
        address created = fresh.createPair(address(usdc), address(dai));
        assertTrue(created != address(0));
        assertEq(fresh.getPair(address(usdc), address(dai)), created);
    }

    function test031FactoryCreatesDeterministicPairAtPrediction() public {
        PairFactory fresh = new PairFactory(deployer, deployer);
        bytes32 salt = keccak256("salt");
        address predicted = fresh.predictPairAddress(address(usdc), address(dai), salt);
        address created = fresh.createPairDeterministic(address(usdc), address(dai), salt);
        assertEq(created, predicted);
    }

    function test032FactoryRejectsDuplicatePair() public {
        vm.expectRevert(PairFactory.PairExists.selector);
        factory.createPair(address(usdc), address(weth));
    }

    function test033FactoryRejectsIdenticalTokens() public {
        PairFactory fresh = new PairFactory(deployer, deployer);
        vm.expectRevert(PairFactory.IdenticalTokens.selector);
        fresh.createPair(address(usdc), address(usdc));
    }

    function test034FactoryRejectsZeroToken() public {
        PairFactory fresh = new PairFactory(deployer, deployer);
        vm.expectRevert(PairFactory.ZeroAddress.selector);
        fresh.createPair(address(0), address(usdc));
    }

    function test035FactoryUpdatesFeeRecipient() public {
        factory.setFeeRecipient(alice);
        assertEq(factory.feeRecipient(), alice);
    }

    function test036FactoryRejectsUnauthorizedFeeRecipientUpdate() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setFeeRecipient(attacker);
    }

    function test037FactoryRejectsZeroFeeRecipient() public {
        vm.expectRevert(PairFactory.ZeroAddress.selector);
        factory.setFeeRecipient(address(0));
    }

    function test038PairConstructorSortsTokens() public {
        assertTrue(pair.token0() < pair.token1());
    }

    function test039PairRejectsIdenticalTokenConstructor() public {
        vm.expectRevert(DefiSwapPair.IdenticalTokens.selector);
        new DefiSwapPair(address(usdc), address(usdc), deployer, deployer);
    }

    function test040PairRejectsZeroOwnerConstructor() public {
        vm.expectRevert();
        new DefiSwapPair(address(usdc), address(weth), deployer, address(0));
    }

    function test041PairUpdatesFeeRecipient() public {
        pair.setFeeRecipient(alice);
        assertEq(pair.feeRecipient(), alice);
    }

    function test042PairRejectsUnauthorizedFeeRecipientUpdate() public {
        vm.prank(attacker);
        vm.expectRevert();
        pair.setFeeRecipient(attacker);
    }

    function test043PairRejectsZeroFeeRecipient() public {
        vm.expectRevert(DefiSwapPair.ZeroAddress.selector);
        pair.setFeeRecipient(address(0));
    }

    function test044PairAddsInitialLiquidity() public {
        _addPairLiquidity(1_000 ether, 1_000 ether);
        assertGt(pair.totalSupply(), 0);
        (uint112 reserve0, uint112 reserve1) = pair.getReserves();
        assertEq(reserve0, 1_000 ether);
        assertEq(reserve1, 1_000 ether);
    }

    function test045PairRejectsZeroLiquidity() public {
        vm.expectRevert(DefiSwapPair.ZeroAmount.selector);
        pair.addLiquidity(0, 1 ether, 1, deployer);
    }

    function test046PairRejectsZeroLiquidityRecipient() public {
        vm.expectRevert(DefiSwapPair.ZeroAddress.selector);
        pair.addLiquidity(1 ether, 1 ether, 1, address(0));
    }

    function test047PairAddsSubsequentLiquidity() public {
        _addPairLiquidity(1_000 ether, 1_000 ether);
        _addPairLiquidity(500 ether, 500 ether);
        (uint112 reserve0, uint112 reserve1) = pair.getReserves();
        assertEq(reserve0, 1_500 ether);
        assertEq(reserve1, 1_500 ether);
    }

    function test048PairQuotesSwapOutput() public {
        _addPairLiquidity(1_000 ether, 1_000 ether);
        assertGt(pair.getAmountOut(10 ether, pair.token0()), 0);
    }

    function test049PairRejectsInvalidQuoteToken() public {
        vm.expectRevert(DefiSwapPair.InvalidToken.selector);
        pair.getAmountOut(10 ether, address(dai));
    }

    function test050PairRejectsZeroQuoteInput() public {
        address tokenIn = pair.token0();
        vm.expectRevert(DefiSwapPair.InsufficientInputAmount.selector);
        pair.getAmountOut(0, tokenIn);
    }

    function test051PairSwapsAndKeepsKNonDecreasing() public {
        _addPairLiquidity(1_000 ether, 1_000 ether);
        (uint112 before0, uint112 before1) = pair.getReserves();
        uint256 out = pair.getAmountOut(10 ether, pair.token0());
        MockERC20(pair.token0()).mint(alice, 10 ether);
        vm.startPrank(alice);
        IERC20(pair.token0()).approve(address(pair), 10 ether);
        pair.swapExactTokensForTokens(10 ether, out, pair.token0(), alice);
        vm.stopPrank();
        (uint112 after0, uint112 after1) = pair.getReserves();
        assertGe(uint256(after0) * uint256(after1), uint256(before0) * uint256(before1));
    }

    function test052PairRejectsSwapSlippage() public {
        _addPairLiquidity(1_000 ether, 1_000 ether);
        address tokenIn = pair.token0();
        MockERC20(tokenIn).mint(alice, 10 ether);
        vm.startPrank(alice);
        IERC20(tokenIn).approve(address(pair), 10 ether);
        vm.expectRevert(DefiSwapPair.InsufficientOutputAmount.selector);
        pair.swapExactTokensForTokens(10 ether, type(uint256).max, tokenIn, alice);
        vm.stopPrank();
    }

    function test053PairRejectsInvalidSwapToken() public {
        _addPairLiquidity(1_000 ether, 1_000 ether);
        vm.expectRevert(DefiSwapPair.InvalidToken.selector);
        pair.swapExactTokensForTokens(1 ether, 1, address(dai), alice);
    }

    function test054PairRejectsZeroSwapRecipient() public {
        _addPairLiquidity(1_000 ether, 1_000 ether);
        address tokenIn = pair.token0();
        vm.expectRevert(DefiSwapPair.ZeroAddress.selector);
        pair.swapExactTokensForTokens(1 ether, 1, tokenIn, address(0));
    }

    function test055PairRemovesLiquidity() public {
        _addPairLiquidity(1_000 ether, 1_000 ether);
        uint256 shares = pair.balanceOf(deployer) / 2;
        pair.removeLiquidity(shares, 1, 1, deployer);
        assertLt(pair.balanceOf(deployer), pair.totalSupply());
    }

    function test056PairRejectsZeroRemoveLiquidity() public {
        vm.expectRevert(DefiSwapPair.ZeroAmount.selector);
        pair.removeLiquidity(0, 1, 1, deployer);
    }

    function test057PairSyncsReserves() public {
        IERC20(pair.token0()).transfer(address(pair), 11 ether);
        IERC20(pair.token1()).transfer(address(pair), 13 ether);
        pair.sync();
        (uint112 reserve0, uint112 reserve1) = pair.getReserves();
        assertEq(reserve0, 11 ether);
        assertEq(reserve1, 13 ether);
    }

    function test058VaultMetadataAndAsset() public {
        assertEq(vault.name(), "DeFi Student Vault Share");
        assertEq(vault.symbol(), "dsvSHARE");
        assertEq(vault.asset(), address(usdc));
    }

    function test059VaultDepositsAssets() public {
        _depositVault(alice, 100 ether);
        assertEq(vault.balanceOf(alice), 100 ether);
    }

    function test060VaultMintsShares() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 100 ether);
        vault.mint(50 ether, alice);
        vm.stopPrank();
        assertEq(vault.balanceOf(alice), 50 ether);
    }

    function test061VaultWithdrawsAssets() public {
        _depositVault(alice, 100 ether);
        vm.prank(alice);
        vault.withdraw(40 ether, alice, alice);
        assertEq(vault.balanceOf(alice), 60 ether);
    }

    function test062VaultRedeemsShares() public {
        _depositVault(alice, 100 ether);
        vm.prank(alice);
        vault.redeem(25 ether, alice, alice);
        assertEq(vault.balanceOf(alice), 75 ether);
    }

    function test063VaultReportsYield() public {
        usdc.approve(address(vault), 10 ether);
        vault.reportYield(10 ether);
        assertEq(vault.totalAssets(), 10 ether);
    }

    function test064VaultRejectsUnauthorizedReportYield() public {
        vm.prank(attacker);
        vm.expectRevert();
        vault.reportYield(1 ether);
    }

    function test065VaultPauseBlocksDeposit() public {
        vault.pause();
        vm.startPrank(alice);
        usdc.approve(address(vault), 1 ether);
        vm.expectRevert();
        vault.deposit(1 ether, alice);
        vm.stopPrank();
    }

    function test066VaultUnpauseRestoresDeposit() public {
        vault.pause();
        vault.unpause();
        _depositVault(alice, 1 ether);
        assertEq(vault.balanceOf(alice), 1 ether);
    }

    function test067ItemsRolesAreAssigned() public {
        assertTrue(items.hasRole(items.DEFAULT_ADMIN_ROLE(), deployer));
        assertTrue(items.hasRole(items.MINTER_ROLE(), deployer));
        assertTrue(items.hasRole(items.URI_SETTER_ROLE(), deployer));
        assertTrue(items.hasRole(items.PAUSER_ROLE(), deployer));
    }

    function test068ItemsMintSingle() public {
        items.mint(alice, 1, 5, "");
        assertEq(items.balanceOf(alice, 1), 5);
        assertEq(items.totalSupply(1), 5);
    }

    function test069ItemsMintBatch() public {
        uint256[] memory ids = new uint256[](2);
        uint256[] memory amounts = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;
        amounts[0] = 5;
        amounts[1] = 7;
        items.mintBatch(alice, ids, amounts, "");
        assertEq(items.balanceOf(alice, 1), 5);
        assertEq(items.balanceOf(alice, 2), 7);
    }

    function test070ItemsRejectUnauthorizedMint() public {
        vm.prank(attacker);
        vm.expectRevert();
        items.mint(attacker, 1, 1, "");
    }

    function test071ItemsSetUriAuthorized() public {
        items.setURI("ipfs://new/{id}.json");
    }

    function test072ItemsPauseBlocksTransfer() public {
        items.mint(alice, 1, 1, "");
        items.pause();
        vm.prank(alice);
        vm.expectRevert();
        items.safeTransferFrom(alice, bob, 1, 1, "");
    }

    function test073ItemsUnpauseRestoresTransfer() public {
        items.mint(alice, 1, 1, "");
        items.pause();
        items.unpause();
        vm.prank(alice);
        items.safeTransferFrom(alice, bob, 1, 1, "");
        assertEq(items.balanceOf(bob, 1), 1);
    }

    function test074OracleReadsFreshPrice() public {
        (uint256 price, uint8 decimals, uint256 updatedAt) = oracle.getPrice(address(weth));
        assertEq(price, 3000_00000000);
        assertEq(decimals, 8);
        assertEq(updatedAt, block.timestamp);
    }

    function test075OracleScalesPriceTo18Decimals() public {
        assertEq(oracle.getPrice18(address(weth)), 3000 ether);
    }

    function test076OracleRejectsUnsetFeed() public {
        vm.expectRevert();
        oracle.getPrice(address(dai));
    }

    function test077OracleRejectsStalePrice() public {
        ethFeed.setStaleAnswer(3000_00000000, block.timestamp - 2 days);
        vm.expectRevert();
        oracle.getPrice(address(weth));
    }

    function test078OracleRejectsInvalidPrice() public {
        ethFeed.updateAnswer(0);
        vm.expectRevert(ChainlinkPriceOracle.InvalidPrice.selector);
        oracle.getPrice(address(weth));
    }

    function test079OracleRemovesFeed() public {
        oracle.removeFeed(address(weth));
        vm.expectRevert();
        oracle.getPrice(address(weth));
    }

    function test080OracleRejectsUnauthorizedSetFeed() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.setFeed(address(dai), address(ethFeed), 1 days);
    }

    function test081AssemblyMathMatchesSolidity() public {
        uint256[] memory values = new uint256[](4);
        values[0] = 1;
        values[1] = 2;
        values[2] = 3;
        values[3] = 4;
        assertEq(assemblyMath.sumYul(values), assemblyMath.sumSolidity(values));
    }

    function test082PairRejectsTooHighMinShares() public {
        IERC20(pair.token0()).approve(address(pair), 1_000 ether);
        IERC20(pair.token1()).approve(address(pair), 1_000 ether);
        vm.expectRevert(DefiSwapPair.InsufficientLiquidityMinted.selector);
        pair.addLiquidity(1_000 ether, 1_000 ether, type(uint256).max, deployer);
    }

    function test083OracleReturnsFeedConfig() public {
        (address feed, uint48 staleAfter, bool enabled) = oracle.feedConfig(address(weth));
        assertEq(feed, address(ethFeed));
        assertEq(staleAfter, 1 days);
        assertTrue(enabled);
    }

    function test084OracleScalesDownTo18Decimals() public {
        MockV3Aggregator highDecimalsFeed = new MockV3Aggregator(20, 123_00000000000000000000, "HIGH / USD");
        oracle.setFeed(address(dai), address(highDecimalsFeed), 1 days);
        assertEq(oracle.getPrice18(address(dai)), 123 ether);
    }

    function test085ProtocolItemsSupportsInterfaces() public {
        assertTrue(items.supportsInterface(type(IERC165).interfaceId));
        assertTrue(items.supportsInterface(0xd9b67a26));
    }

    function test086TreasuryVersionIsV1() public view {
        assertEq(treasury.version(), "1.0.0");
    }

    function test087TreasuryV2PingIsCallableAfterUpgrade() public {
        ProtocolTreasuryV2 v2 = new ProtocolTreasuryV2();
        treasury.upgradeToAndCall(address(v2), "");
        ProtocolTreasuryV2(payable(address(treasury))).pingV2();
    }

    function test088GovernorQueuesAndExecutesThroughTimelock() public {
        bytes32 proposerRole = timelock.PROPOSER_ROLE();
        bytes32 cancellerRole = timelock.CANCELLER_ROLE();
        bytes32 executorRole = timelock.EXECUTOR_ROLE();
        timelock.grantRole(proposerRole, address(governor));
        timelock.grantRole(cancellerRole, address(governor));
        timelock.grantRole(executorRole, address(0));
        items.grantRole(items.MINTER_ROLE(), address(timelock));
        vm.warp(block.timestamp + 1);

        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);
        targets[0] = address(items);
        calldatas[0] = abi.encodeCall(ProtocolItems.mint, (alice, 99, 1, ""));
        string memory description = "mint item through foundry governance";

        uint256 proposalId = governor.propose(targets, values, calldatas, description);
        assertTrue(governor.proposalNeedsQueuing(proposalId));
        vm.warp(block.timestamp + governor.votingDelay() + 1);
        governor.castVote(proposalId, 1);
        vm.warp(block.timestamp + governor.votingPeriod() + 1);
        assertEq(uint256(governor.state(proposalId)), 4);
        bytes32 descriptionHash = keccak256(bytes(description));
        governor.queue(targets, values, calldatas, descriptionHash);
        vm.warp(block.timestamp + timelock.getMinDelay() + 1);
        governor.execute(targets, values, calldatas, descriptionHash);
        assertEq(items.balanceOf(alice, 99), 1);
    }
}

contract ProtocolFuzzTest is ProtocolFoundryBase {
    function testFuzz001AmmSwapKeepsK(uint128 rawLiquidity, uint96 rawAmountIn) public {
        uint256 liquidity = bound(uint256(rawLiquidity), 10_000 ether, 1_000_000 ether);
        uint256 amountIn = bound(uint256(rawAmountIn), 1 ether, liquidity / 10);
        _addPairLiquidity(liquidity, liquidity);
        (uint112 before0, uint112 before1) = pair.getReserves();
        address tokenIn = pair.token0();
        uint256 out = pair.getAmountOut(amountIn, tokenIn);
        MockERC20(tokenIn).mint(alice, amountIn);
        vm.startPrank(alice);
        IERC20(tokenIn).approve(address(pair), amountIn);
        pair.swapExactTokensForTokens(amountIn, out, tokenIn, alice);
        vm.stopPrank();
        (uint112 after0, uint112 after1) = pair.getReserves();
        assertGe(uint256(after0) * uint256(after1), uint256(before0) * uint256(before1));
    }

    function testFuzz002AmmQuoteRejectsUnknownToken(address unknown, uint96 amount) public {
        vm.assume(unknown != pair.token0() && unknown != pair.token1());
        vm.assume(unknown != address(0));
        _addPairLiquidity(1000 ether, 1000 ether);
        vm.expectRevert(DefiSwapPair.InvalidToken.selector);
        pair.getAmountOut(bound(uint256(amount), 1, 100 ether), unknown);
    }

    function testFuzz003VaultDeposit(uint96 rawAssets) public {
        uint256 assets = bound(uint256(rawAssets), 1, 100_000 ether);
        _depositVault(alice, assets);
        assertEq(vault.balanceOf(alice), assets);
        assertEq(vault.totalAssets(), assets);
    }

    function testFuzz004VaultWithdraw(uint96 rawDeposit, uint96 rawWithdraw) public {
        uint256 depositAssets = bound(uint256(rawDeposit), 2 ether, 100_000 ether);
        uint256 withdrawAssets = bound(uint256(rawWithdraw), 1, depositAssets);
        _depositVault(alice, depositAssets);
        vm.prank(alice);
        vault.withdraw(withdrawAssets, alice, alice);
        assertEq(vault.totalAssets(), depositAssets - withdrawAssets);
    }

    function testFuzz005VaultRedeem(uint96 rawDeposit, uint96 rawRedeem) public {
        uint256 depositAssets = bound(uint256(rawDeposit), 2 ether, 100_000 ether);
        uint256 shares = bound(uint256(rawRedeem), 1, depositAssets);
        _depositVault(alice, depositAssets);
        vm.prank(alice);
        vault.redeem(shares, alice, alice);
        assertEq(vault.balanceOf(alice), depositAssets - shares);
    }

    function testFuzz006GovernanceVotingPower(address voter, uint96 rawAmount) public {
        vm.assume(voter != address(0));
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000 ether);
        governanceToken.mint(voter, amount);
        vm.prank(voter);
        governanceToken.delegate(voter);
        assertEq(governanceToken.getVotes(voter), amount);
    }

    function testFuzz007TreasuryTokenDeposit(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 100_000 ether);
        usdc.approve(address(treasury), amount);
        treasury.depositToken(usdc, amount);
        assertEq(usdc.balanceOf(address(treasury)), amount);
    }

    function testFuzz008OracleFreshnessWindow(uint32 staleAfter) public {
        uint48 window = uint48(bound(uint256(staleAfter), 1, 30 days));
        oracle.setFeed(address(dai), address(ethFeed), window);
        (uint256 price,,) = oracle.getPrice(address(dai));
        assertEq(price, 3000_00000000);
    }

    function testFuzz009ItemsMintAmount(uint128 id, uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000);
        items.mint(alice, uint256(id), amount, "");
        assertEq(items.balanceOf(alice, uint256(id)), amount);
    }

    function testFuzz010FactoryPredictMatchesCreate2(bytes32 salt) public {
        PairFactory fresh = new PairFactory(deployer, deployer);
        address predicted = fresh.predictPairAddress(address(dai), address(weth), salt);
        address created = fresh.createPairDeterministic(address(dai), address(weth), salt);
        assertEq(created, predicted);
    }
}

contract AmmSwapHandler {
    DefiSwapPair public immutable pair;

    constructor(DefiSwapPair pair_) {
        pair = pair_;
        IERC20(pair.token0()).approve(address(pair), type(uint256).max);
        IERC20(pair.token1()).approve(address(pair), type(uint256).max);
    }

    function swapToken0(uint96 rawAmountIn) external {
        uint256 amountIn = _boundedAmount(rawAmountIn, pair.token0());
        if (amountIn == 0) return;
        try pair.getAmountOut(amountIn, pair.token0()) returns (uint256 amountOut) {
            if (amountOut > 0) {
                pair.swapExactTokensForTokens(amountIn, 0, pair.token0(), address(this));
            }
        } catch {}
    }

    function swapToken1(uint96 rawAmountIn) external {
        uint256 amountIn = _boundedAmount(rawAmountIn, pair.token1());
        if (amountIn == 0) return;
        try pair.getAmountOut(amountIn, pair.token1()) returns (uint256 amountOut) {
            if (amountOut > 0) {
                pair.swapExactTokensForTokens(amountIn, 0, pair.token1(), address(this));
            }
        } catch {}
    }

    function _boundedAmount(uint96 rawAmountIn, address tokenIn) private view returns (uint256) {
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        if (balance == 0) return 0;
        uint256 maxAmount = balance / 100;
        if (maxAmount == 0) maxAmount = balance;
        return (uint256(rawAmountIn) % maxAmount) + 1;
    }
}

contract ProtocolInvariantTest is StdInvariant, ProtocolFoundryBase {
    uint256 internal initialPairK;
    uint256 internal initialTreasuryTokenBalance;
    AmmSwapHandler internal swapHandler;

    function setUp() public override {
        super.setUp();
        _addPairLiquidity(10_000 ether, 10_000 ether);
        (uint112 reserve0, uint112 reserve1) = pair.getReserves();
        initialPairK = uint256(reserve0) * uint256(reserve1);
        _fundTreasuryToken(500 ether);
        initialTreasuryTokenBalance = usdc.balanceOf(address(treasury));
        swapHandler = new AmmSwapHandler(pair);
        MockERC20(pair.token0()).mint(address(swapHandler), 100_000 ether);
        MockERC20(pair.token1()).mint(address(swapHandler), 100_000 ether);
        targetContract(address(swapHandler));
    }

    function invariant001ConstantProductIsInitialized() public view {
        (uint112 reserve0, uint112 reserve1) = pair.getReserves();
        assertGe(uint256(reserve0) * uint256(reserve1), initialPairK);
    }

    function invariant002LpSupplyIsAtLeastBurnedMinimum() public view {
        assertGe(pair.totalSupply(), pair.MINIMUM_LIQUIDITY());
        assertEq(pair.balanceOf(address(0xdead)), pair.MINIMUM_LIQUIDITY());
    }

    function invariant003TreasuryTokenAccountingNeverExceedsTokenBalance() public view {
        assertGe(usdc.balanceOf(address(treasury)), initialTreasuryTokenBalance);
    }

    function invariant004VaultAssetsEqualUnderlyingBalanceWhenNoDebt() public view {
        assertEq(vault.totalAssets(), usdc.balanceOf(address(vault)));
    }

    function invariant005UnauthorizedActorsHaveNoPrivilegedRoles() public view {
        assertFalse(treasury.hasRole(treasury.TREASURER_ROLE(), attacker));
        assertFalse(items.hasRole(items.MINTER_ROLE(), attacker));
        assertTrue(factory.owner() != attacker);
    }
}

contract SecurityCaseStudiesTest is ProtocolFoundryBase {
    function testCaseStudy001ReentrancyBeforeExploitReproduced() public {
        VulnerableNativeVault vulnerable = new VulnerableNativeVault();
        ReentrancyAttacker exploit = new ReentrancyAttacker(vulnerable);
        vulnerable.deposit{value: 5 ether}();
        exploit.attack{value: 1 ether}();
        assertGt(address(exploit).balance, 1 ether);
    }

    function testCaseStudy002ReentrancyAfterFixedByTreasuryGuardAndRoles() public {
        (bool ok,) = address(treasury).call{value: 5 ether}("");
        assertTrue(ok);
        TreasuryReentryProbe probe = new TreasuryReentryProbe(treasury);
        treasury.releaseNative(payable(address(probe)), 1 ether);
        assertEq(address(probe).balance, 1 ether);
        assertEq(address(treasury).balance, 4 ether);
    }

    function testCaseStudy003AccessControlBeforeExploitReproduced() public {
        VulnerableAdminRegistry vulnerable = new VulnerableAdminRegistry(deployer);
        vm.prank(attacker);
        vulnerable.setAdmin(attacker);
        assertEq(vulnerable.admin(), attacker);
    }

    function testCaseStudy004AccessControlAfterFixedByOnlyOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        factory.setFeeRecipient(attacker);
        assertEq(factory.feeRecipient(), deployer);
    }
}

contract ForkIntegrationTest is Test {
    address internal constant MAINNET_USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address internal constant MAINNET_WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address internal constant MAINNET_ETH_USD_FEED = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address internal constant MAINNET_UNISWAP_V2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

    function _selectMainnetForkOrSkip() internal returns (bool) {
        string memory rpcUrl = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            emit log("MAINNET_RPC_URL not set; skipping fork assertion body");
            return false;
        }
        vm.selectFork(vm.createFork(rpcUrl));
        return true;
    }

    function testFork001ReadsMainnetUsdcMetadata() public {
        if (!_selectMainnetForkOrSkip()) return;
        assertEq(IERC20Metadata(MAINNET_USDC).decimals(), 6);
        assertEq(IERC20Metadata(MAINNET_USDC).symbol(), "USDC");
    }

    function testFork002ReadsMainnetChainlinkEthUsdFeed() public {
        if (!_selectMainnetForkOrSkip()) return;
        (, int256 answer,, uint256 updatedAt,) = IAggregatorLike(MAINNET_ETH_USD_FEED).latestRoundData();
        assertGt(answer, 0);
        assertGt(updatedAt, 0);
        assertEq(IAggregatorLike(MAINNET_ETH_USD_FEED).decimals(), 8);
    }

    function testFork003QuotesMainnetUniswapV2Router() public {
        if (!_selectMainnetForkOrSkip()) return;
        address[] memory path = new address[](2);
        path[0] = MAINNET_WETH;
        path[1] = MAINNET_USDC;
        uint256[] memory amounts = IUniswapV2RouterLike(MAINNET_UNISWAP_V2_ROUTER).getAmountsOut(1 ether, path);
        assertEq(amounts.length, 2);
        assertGt(amounts[1], 0);
    }
}
