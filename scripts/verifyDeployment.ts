import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ZERO_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
  console.log(`ok - ${label}`);
}

function deploymentFilePath() {
  return process.env.DEPLOYMENT_FILE || path.join("deployments", `${network.name}.json`);
}

function loadDeployment() {
  const filePath = deploymentFilePath();
  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
  const deployment = loadDeployment();
  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();

  const token = await ethers.getContractAt("GovernanceToken", deployment.governanceToken);
  const timelock = await ethers.getContractAt("TimelockController", deployment.timelock);
  const governor = await ethers.getContractAt("ProtocolGovernor", deployment.governor);
  const treasury = await ethers.getContractAt("ProtocolTreasury", deployment.treasuryProxy);
  const vault = await ethers.getContractAt("YieldVault", deployment.vault);
  const oracle = await ethers.getContractAt("ChainlinkPriceOracle", deployment.oracle);
  const factory = await ethers.getContractAt("PairFactory", deployment.pairFactory);
  let ammPair = deployment.ammPair;
  if (!ammPair || ammPair === ethers.ZeroAddress) {
    const pairCount = await factory.allPairsLength();
    if (pairCount === 0n) throw new Error("factory has no AMM pairs");
    ammPair = await factory.allPairs(pairCount - 1n);
    deployment.ammPair = ammPair;
    fs.writeFileSync(deploymentFilePath(), `${JSON.stringify(deployment, null, 2)}\n`);
    console.log(`ok - recovered AMM pair address ${ammPair}`);
  }
  const pair = await ethers.getContractAt("DefiSwapPair", ammPair);

  assertEqual(Number(await timelock.getMinDelay()), 2 * 24 * 60 * 60, "timelock delay is 2 days");
  assertEqual(await timelock.hasRole(ZERO_ROLE, deployer), false, "deployer no longer has timelock admin");
  assertEqual(await timelock.hasRole(ZERO_ROLE, deployment.timelock), true, "timelock self-admin remains");

  assertEqual(Number(await governor.votingDelay()), 24 * 60 * 60, "governor voting delay is 1 day");
  assertEqual(Number(await governor.votingPeriod()), 7 * 24 * 60 * 60, "governor voting period is 1 week");
  assertEqual(Number(await governor["quorumNumerator()"]()), 4, "governor quorum is 4%");
  assertEqual((await governor.proposalThreshold()).toString(), deployment.governance.proposalThreshold, "proposal threshold is 1%");

  assertEqual(await token.owner(), deployment.timelock, "governance token owner is timelock");
  assertEqual(await vault.owner(), deployment.timelock, "vault owner is timelock");
  assertEqual(await oracle.owner(), deployment.timelock, "oracle owner is timelock");
  assertEqual(await factory.owner(), deployment.timelock, "factory owner is timelock");
  assertEqual(await pair.owner(), deployment.timelock, "pair owner is timelock");

  assertEqual(await treasury.hasRole(ZERO_ROLE, deployment.timelock), true, "treasury admin is timelock");
  assertEqual(await treasury.hasRole(await treasury.TREASURER_ROLE(), deployment.timelock), true, "treasury treasurer is timelock");
  assertEqual(await treasury.hasRole(await treasury.UPGRADER_ROLE(), deployment.timelock), true, "treasury upgrader is timelock");

  console.log(`Deployment verification passed for ${deployment.network}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
