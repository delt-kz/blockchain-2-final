import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const TWO_DAYS = 2 * 24 * 60 * 60;
const ONE_MILLION = ethers.parseEther("1000000");
const PROPOSAL_THRESHOLD = ONE_MILLION / 100n;

async function deployContract(name: string, args: unknown[] = []) {
  const contract = await ethers.deployContract(name, args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`${name}: ${address}`);
  return contract;
}

async function wait(txPromise: Promise<unknown>) {
  const tx = (await txPromise) as { wait: () => Promise<unknown> };
  await tx.wait();
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log(`Deploying to ${network.name} from ${deployerAddress}`);

  const governanceToken = await deployContract("GovernanceToken", [deployerAddress]);
  await wait(governanceToken.mint(deployerAddress, ONE_MILLION));
  await wait(governanceToken.delegate(deployerAddress));

  const timelock = await deployContract("TimelockController", [TWO_DAYS, [], [], deployerAddress]);
  const timelockAddress = await timelock.getAddress();

  const governor = await deployContract("ProtocolGovernor", [
    await governanceToken.getAddress(),
    timelockAddress,
    PROPOSAL_THRESHOLD,
  ]);
  const governorAddress = await governor.getAddress();

  const proposerRole = await timelock.PROPOSER_ROLE();
  const executorRole = await timelock.EXECUTOR_ROLE();
  const cancellerRole = await timelock.CANCELLER_ROLE();
  const adminRole = await timelock.DEFAULT_ADMIN_ROLE();
  await wait(timelock.grantRole(proposerRole, governorAddress));
  await wait(timelock.grantRole(cancellerRole, governorAddress));
  await wait(timelock.grantRole(executorRole, ethers.ZeroAddress));

  const treasuryImpl = await deployContract("ProtocolTreasury");
  const initData = treasuryImpl.interface.encodeFunctionData("initialize", [timelockAddress]);
  const treasuryProxy = await deployContract("ProtocolProxy", [await treasuryImpl.getAddress(), initData]);
  const treasury = await ethers.getContractAt("ProtocolTreasury", await treasuryProxy.getAddress());
  const treasuryAddress = await treasury.getAddress();

  const usdc = await deployContract("MockERC20", ["Student USD", "sUSD", 6, deployerAddress]);
  const weth = await deployContract("MockERC20", ["Wrapped Student ETH", "sWETH", 18, deployerAddress]);
  await wait(usdc.mint(deployerAddress, ethers.parseUnits("1000000", 6)));
  await wait(weth.mint(deployerAddress, ethers.parseEther("1000")));

  const vault = await deployContract("YieldVault", [await usdc.getAddress(), timelockAddress]);
  const items = await deployContract("ProtocolItems", ["ipfs://student-protocol/{id}.json", timelockAddress]);

  const oracle = await deployContract("ChainlinkPriceOracle", [deployerAddress]);
  const staleAfter = Number(process.env.STALE_AFTER_SECONDS || "86400");
  let ethUsdFeed = process.env.CHAINLINK_ETH_USD_FEED || "";
  let usdcUsdFeed = process.env.CHAINLINK_USDC_USD_FEED || "";
  let mockEthFeed = "";
  let mockUsdcFeed = "";

  if (ethUsdFeed.length === 0) {
    const feed = await deployContract("MockV3Aggregator", [8, 3000_00000000n, "Mock ETH / USD"]);
    ethUsdFeed = await feed.getAddress();
    mockEthFeed = ethUsdFeed;
  }
  if (usdcUsdFeed.length === 0) {
    const feed = await deployContract("MockV3Aggregator", [8, 1_00000000n, "Mock USDC / USD"]);
    usdcUsdFeed = await feed.getAddress();
    mockUsdcFeed = usdcUsdFeed;
  }

  await wait(oracle.setFeed(await weth.getAddress(), ethUsdFeed, staleAfter));
  await wait(oracle.setFeed(await usdc.getAddress(), usdcUsdFeed, staleAfter));

  const factory = await deployContract("PairFactory", [treasuryAddress, deployerAddress]);
  const salt = ethers.keccak256(ethers.toUtf8Bytes("student-demo-pair-v1"));
  await wait(factory.createPairDeterministic(await usdc.getAddress(), await weth.getAddress(), salt));
  const pairAddress = await factory.getPair(await usdc.getAddress(), await weth.getAddress());
  const pair = await ethers.getContractAt("DefiSwapPair", pairAddress);

  await wait(pair.transferOwnership(timelockAddress));
  await wait(factory.transferOwnership(timelockAddress));
  await wait(oracle.transferOwnership(timelockAddress));
  await wait(governanceToken.transferOwnership(timelockAddress));
  await wait(timelock.revokeRole(adminRole, deployerAddress));

  const deployment = {
    network: network.name,
    chainId: network.config.chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployerAddress,
    governanceToken: await governanceToken.getAddress(),
    timelock: timelockAddress,
    governor: governorAddress,
    treasuryImplementation: await treasuryImpl.getAddress(),
    treasuryProxy: treasuryAddress,
    treasuryInitData: initData,
    usdc: await usdc.getAddress(),
    weth: await weth.getAddress(),
    vault: await vault.getAddress(),
    items: await items.getAddress(),
    oracle: await oracle.getAddress(),
    ethUsdFeed,
    usdcUsdFeed,
    mockEthFeed,
    mockUsdcFeed,
    pairFactory: await factory.getAddress(),
    ammPair: pairAddress,
    governance: {
      timelockDelay: TWO_DAYS,
      votingDelay: 24 * 60 * 60,
      votingPeriod: 7 * 24 * 60 * 60,
      quorumPercent: 4,
      proposalThreshold: PROPOSAL_THRESHOLD.toString(),
    },
  };

  fs.mkdirSync("deployments", { recursive: true });
  const outputPath = path.join("deployments", `${network.name}.json`);
  fs.writeFileSync(outputPath, `${JSON.stringify(deployment, null, 2)}\n`);
  console.log(`Saved deployment to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
