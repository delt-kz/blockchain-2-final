import { run, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function loadDeployment() {
  const file = process.env.DEPLOYMENT_FILE || path.join("deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Deployment file not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function verify(address: string, constructorArguments: unknown[], contract?: string) {
  try {
    await run("verify:verify", { address, constructorArguments, contract });
    console.log(`verified ${address}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log(`already verified ${address}`);
      return;
    }
    console.warn(`verify failed for ${address}: ${message}`);
  }
}

function sortAddresses(a: string, b: string) {
  return BigInt(a) < BigInt(b) ? [a, b] : [b, a];
}

async function main() {
  const d = loadDeployment();
  const [token0, token1] = sortAddresses(d.usdc, d.weth);

  await verify(d.governanceToken, [d.deployer]);
  await verify(d.timelock, [d.governance.timelockDelay, [], [], d.deployer], "@openzeppelin/contracts/governance/TimelockController.sol:TimelockController");
  await verify(d.governor, [d.governanceToken, d.timelock, d.governance.proposalThreshold]);
  await verify(d.treasuryImplementation, []);
  await verify(d.treasuryProxy, [d.treasuryImplementation, d.treasuryInitData]);
  await verify(d.usdc, ["Student USD", "sUSD", 6, d.deployer]);
  await verify(d.weth, ["Wrapped Student ETH", "sWETH", 18, d.deployer]);
  await verify(d.vault, [d.usdc, d.timelock]);
  await verify(d.items, ["ipfs://student-protocol/{id}.json", d.timelock]);
  await verify(d.oracle, [d.deployer]);

  if (d.mockEthFeed) {
    await verify(d.mockEthFeed, [8, 3000_00000000n, "Mock ETH / USD"]);
  }
  if (d.mockUsdcFeed) {
    await verify(d.mockUsdcFeed, [8, 1_00000000n, "Mock USDC / USD"]);
  }

  await verify(d.pairFactory, [d.treasuryProxy, d.deployer]);
  await verify(d.ammPair, [token0, token1, d.treasuryProxy, d.deployer]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
