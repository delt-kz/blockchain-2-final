import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

function loadDeployment() {
  const filePath = path.join("deployments", `${network.name}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment file not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
  const deployment = loadDeployment();
  const [proposer] = await ethers.getSigners();
  const proposerAddress = await proposer.getAddress();
  const governor = await ethers.getContractAt("ProtocolGovernor", deployment.governor);
  const items = await ethers.getContractAt("ProtocolItems", deployment.items);

  const tokenId = 42n;
  const amount = 1n;
  const calldata = items.interface.encodeFunctionData("mint", [proposerAddress, tokenId, amount, "0x"]);
  const description = "Mint one demo ERC1155 item for the final project UI vote";
  const descriptionHash = ethers.id(description);
  const proposalId = await governor.hashProposal([deployment.items], [0], [calldata], descriptionHash);

  try {
    const currentState = await governor.state(proposalId);
    console.log(`Proposal already exists: ${proposalId.toString()} state=${currentState.toString()}`);
  } catch {
    const tx = await governor.propose([deployment.items], [0], [calldata], description);
    const receipt = await tx.wait();
    console.log(`Created proposal in tx ${receipt?.hash}`);
    console.log(`Proposal id: ${proposalId.toString()}`);
  }

  console.log(JSON.stringify({ proposalId: proposalId.toString(), description, target: deployment.items, calldata }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
