import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function deploymentFilePath() {
  return process.env.DEPLOYMENT_FILE || path.join("deployments", `${network.name}.json`);
}

async function main() {
  const filePath = deploymentFilePath();
  const deployment = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const factory = await ethers.getContractAt("PairFactory", deployment.pairFactory);

  let ammPair = deployment.ammPair;
  if (!ammPair || ammPair === ethers.ZeroAddress) {
    const pairCount = await factory.allPairsLength();
    if (pairCount === 0n) throw new Error("factory has no AMM pairs");
    ammPair = await factory.allPairs(pairCount - 1n);
    deployment.ammPair = ammPair;
    fs.writeFileSync(filePath, `${JSON.stringify(deployment, null, 2)}\n`);
    console.log(`recovered AMM pair address ${ammPair}`);
  }

  const pair = await ethers.getContractAt("DefiSwapPair", ammPair);
  const owner = await pair.owner();
  if (owner !== deployment.timelock) {
    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();
    if (owner !== signerAddress) {
      throw new Error(`pair owner is ${owner}, signer is ${signerAddress}; cannot transfer`);
    }
    const tx = await pair.transferOwnership(deployment.timelock);
    await tx.wait();
    console.log(`transferred pair owner to timelock ${deployment.timelock}`);
  } else {
    console.log("pair owner already timelock");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
