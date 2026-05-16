import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const DAY = 24 * 60 * 60;
const WEEK = 7 * DAY;
const TWO_DAYS = 2 * DAY;

async function wait(txPromise: Promise<unknown>) {
  const tx = (await txPromise) as { wait: () => Promise<unknown> };
  await tx.wait();
}

async function deployCoreFixture() {
  const [deployer, alice, bob, feeRecipient] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  const token: any = await ethers.deployContract("GovernanceToken", [deployerAddress]);
  await token.waitForDeployment();
  await wait(token.mint(deployerAddress, ethers.parseEther("1000000")));
  await wait(token.delegate(deployerAddress));
  await time.increase(1);

  const timelock: any = await ethers.deployContract("TimelockController", [TWO_DAYS, [], [], deployerAddress]);
  await timelock.waitForDeployment();

  const governor: any = await ethers.deployContract("ProtocolGovernor", [
    await token.getAddress(),
    await timelock.getAddress(),
    ethers.parseEther("10000"),
  ]);
  await governor.waitForDeployment();

  await wait(timelock.grantRole(await timelock.PROPOSER_ROLE(), await governor.getAddress()));
  await wait(timelock.grantRole(await timelock.CANCELLER_ROLE(), await governor.getAddress()));
  await wait(timelock.grantRole(await timelock.EXECUTOR_ROLE(), ethers.ZeroAddress));

  const usdc: any = await ethers.deployContract("MockERC20", ["Student USD", "sUSD", 6, deployerAddress]);
  const weth: any = await ethers.deployContract("MockERC20", ["Wrapped Student ETH", "sWETH", 18, deployerAddress]);
  const dai: any = await ethers.deployContract("MockERC20", ["Student DAI", "sDAI", 18, deployerAddress]);
  const btc: any = await ethers.deployContract("MockERC20", ["Student BTC", "sBTC", 8, deployerAddress]);
  await Promise.all([usdc.waitForDeployment(), weth.waitForDeployment(), dai.waitForDeployment(), btc.waitForDeployment()]);

  for (const signer of [deployer, alice, bob]) {
    const account = await signer.getAddress();
    await wait(usdc.mint(account, ethers.parseUnits("100000", 6)));
    await wait(weth.mint(account, ethers.parseEther("100")));
    await wait(dai.mint(account, ethers.parseEther("100000")));
    await wait(btc.mint(account, ethers.parseUnits("10", 8)));
  }

  const treasuryImpl: any = await ethers.deployContract("ProtocolTreasury");
  await treasuryImpl.waitForDeployment();
  const initData = treasuryImpl.interface.encodeFunctionData("initialize", [await timelock.getAddress()]);
  const proxy: any = await ethers.deployContract("ProtocolProxy", [await treasuryImpl.getAddress(), initData]);
  await proxy.waitForDeployment();
  const treasury: any = await ethers.getContractAt("ProtocolTreasury", await proxy.getAddress());

  const vault: any = await ethers.deployContract("YieldVault", [await usdc.getAddress(), deployerAddress]);
  await vault.waitForDeployment();
  const items: any = await ethers.deployContract("ProtocolItems", ["ipfs://student/{id}.json", await timelock.getAddress()]);
  await items.waitForDeployment();
  const oracle: any = await ethers.deployContract("ChainlinkPriceOracle", [deployerAddress]);
  await oracle.waitForDeployment();
  const ethFeed: any = await ethers.deployContract("MockV3Aggregator", [8, 3000_00000000n, "ETH / USD"]);
  await ethFeed.waitForDeployment();
  await wait(oracle.setFeed(await weth.getAddress(), await ethFeed.getAddress(), DAY));

  const factory: any = await ethers.deployContract("PairFactory", [await feeRecipient.getAddress(), deployerAddress]);
  await factory.waitForDeployment();

  return {
    deployer,
    alice,
    bob,
    feeRecipient,
    token,
    timelock,
    governor,
    usdc,
    weth,
    dai,
    btc,
    treasuryImpl,
    treasury,
    vault,
    items,
    oracle,
    ethFeed,
    factory,
  };
}

describe("Smart contract final project slice", function () {
  it("deploys a UUPS treasury and upgrades V1 to V2", async function () {
    const { deployer } = await loadFixture(deployCoreFixture);
    const impl: any = await ethers.deployContract("ProtocolTreasury");
    await impl.waitForDeployment();
    const initData = impl.interface.encodeFunctionData("initialize", [await deployer.getAddress()]);
    const proxy: any = await ethers.deployContract("ProtocolProxy", [await impl.getAddress(), initData]);
    await proxy.waitForDeployment();
    const treasury: any = await ethers.getContractAt("ProtocolTreasury", await proxy.getAddress());
    expect(await treasury.version()).to.equal("1.0.0");

    const v2: any = await ethers.deployContract("ProtocolTreasuryV2");
    await v2.waitForDeployment();
    await wait(treasury.connect(deployer).upgradeToAndCall(await v2.getAddress(), "0x"));

    const upgraded: any = await ethers.getContractAt("ProtocolTreasuryV2", await treasury.getAddress());
    expect(await upgraded.version()).to.equal("2.0.0");
  });

  it("uses CREATE and CREATE2 in the AMM factory", async function () {
    const { factory, usdc, weth, dai, btc } = await loadFixture(deployCoreFixture);

    await wait(factory.createPair(await usdc.getAddress(), await weth.getAddress()));
    const normalPair = await factory.getPair(await usdc.getAddress(), await weth.getAddress());
    expect(normalPair).to.not.equal(ethers.ZeroAddress);

    const salt = ethers.keccak256(ethers.toUtf8Bytes("dai-btc"));
    const predicted = await factory.predictPairAddress(await dai.getAddress(), await btc.getAddress(), salt);
    await wait(factory.createPairDeterministic(await dai.getAddress(), await btc.getAddress(), salt));
    expect(await factory.getPair(await dai.getAddress(), await btc.getAddress())).to.equal(predicted);
    expect(await factory.allPairsLength()).to.equal(2);
  });

  it("adds liquidity, swaps with 0.3% fee, and protects slippage", async function () {
    const { deployer, alice, feeRecipient, factory, usdc, weth } = await loadFixture(deployCoreFixture);
    await wait(factory.createPair(await usdc.getAddress(), await weth.getAddress()));
    const pair: any = await ethers.getContractAt("DefiSwapPair", await factory.getPair(await usdc.getAddress(), await weth.getAddress()));

    const amountUsdc = ethers.parseUnits("30000", 6);
    const amountWeth = ethers.parseEther("10");
    await wait(usdc.approve(await pair.getAddress(), amountUsdc));
    await wait(weth.approve(await pair.getAddress(), amountWeth));
    await wait(pair.addLiquidity(amountUsdc, amountWeth, 1, await deployer.getAddress()));

    const [reserve0Before, reserve1Before] = await pair.getReserves();
    const token0 = await pair.token0();
    const amountIn = token0 === (await usdc.getAddress()) ? ethers.parseUnits("300", 6) : ethers.parseEther("1");
    const input = token0 === (await usdc.getAddress()) ? usdc : weth;
    const output = token0 === (await usdc.getAddress()) ? weth : usdc;
    const quoted = await pair.getAmountOut(amountIn, await input.getAddress());
    await wait(input.connect(alice).approve(await pair.getAddress(), amountIn));

    await expect(pair.connect(alice).swapExactTokensForTokens(amountIn, quoted + 1n, await input.getAddress(), await alice.getAddress()))
      .to.be.revertedWithCustomError(pair, "InsufficientOutputAmount");

    const feeRecipientBalanceBefore = await input.balanceOf(await feeRecipient.getAddress());
    await wait(pair.connect(alice).swapExactTokensForTokens(amountIn, quoted, await input.getAddress(), await alice.getAddress()));
    expect(await output.balanceOf(await alice.getAddress())).to.be.greaterThan(0);
    expect(await input.balanceOf(await feeRecipient.getAddress())).to.be.greaterThan(feeRecipientBalanceBefore);

    const [reserve0After, reserve1After] = await pair.getReserves();
    expect(reserve0After * reserve1After).to.be.greaterThanOrEqual(reserve0Before * reserve1Before);
  });

  it("deposits and withdraws through the ERC4626 vault", async function () {
    const { alice, usdc, vault } = await loadFixture(deployCoreFixture);
    const assets = ethers.parseUnits("1000", 6);
    await wait(usdc.connect(alice).approve(await vault.getAddress(), assets));
    await wait(vault.connect(alice).deposit(assets, await alice.getAddress()));

    expect(await vault.balanceOf(await alice.getAddress())).to.equal(assets);
    expect(await vault.totalAssets()).to.equal(assets);

    await wait(vault.connect(alice).withdraw(ethers.parseUnits("250", 6), await alice.getAddress(), await alice.getAddress()));
    expect(await vault.totalAssets()).to.equal(ethers.parseUnits("750", 6));
  });

  it("pauses vault deposits", async function () {
    const { alice, usdc, vault } = await loadFixture(deployCoreFixture);
    await wait(vault.pause());
    await wait(usdc.connect(alice).approve(await vault.getAddress(), ethers.parseUnits("1", 6)));
    await expect(vault.connect(alice).deposit(ethers.parseUnits("1", 6), await alice.getAddress()))
      .to.be.revertedWithCustomError(vault, "EnforcedPause");
  });

  it("reads Chainlink-style prices and rejects stale feed data", async function () {
    const { oracle, ethFeed, weth } = await loadFixture(deployCoreFixture);
    expect(await oracle.getPrice18(await weth.getAddress())).to.equal(ethers.parseEther("3000"));

    const staleTimestamp = (await time.latest()) - DAY - 5;
    await wait(ethFeed.setStaleAnswer(3000_00000000n, staleTimestamp));
    await expect(oracle.getPrice(await weth.getAddress())).to.be.revertedWithCustomError(oracle, "StalePrice");
  });

  it("keeps ERC1155 minting under timelock access control", async function () {
    const { alice, items } = await loadFixture(deployCoreFixture);
    await expect(items.mint(await alice.getAddress(), 1, 1, "0x")).to.be.reverted;
  });

  it("executes a full Governor and Timelock lifecycle", async function () {
    const { alice, governor, items } = await loadFixture(deployCoreFixture);
    const target = await items.getAddress();
    const calldata = items.interface.encodeFunctionData("mint", [await alice.getAddress(), 7, 3, "0x"]);
    const description = "Mint test ERC1155 item through governance";
    const descriptionHash = ethers.id(description);

    await wait(governor.propose([target], [0], [calldata], description));
    const proposalId = await governor.hashProposal([target], [0], [calldata], descriptionHash);

    await time.increase(DAY + 1);
    await wait(governor.castVote(proposalId, 1));
    await time.increase(WEEK + 1);

    await wait(governor.queue([target], [0], [calldata], descriptionHash));
    await time.increase(TWO_DAYS + 1);
    await wait(governor.execute([target], [0], [calldata], descriptionHash));

    expect(await items.balanceOf(await alice.getAddress(), 7)).to.equal(3);
  });

  it("matches the Yul sum with the pure Solidity implementation", async function () {
    const math: any = await ethers.deployContract("AssemblyMath");
    await math.waitForDeployment();
    const values = [1n, 2n, 3n, 5n, 8n, 13n, 21n];
    expect(await math.sumYul(values)).to.equal(await math.sumSolidity(values));
  });
});
