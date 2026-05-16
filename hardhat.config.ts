import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ quiet: true });

const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = deployerKey && deployerKey.length > 0 ? [deployerKey] : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "",
      accounts,
      chainId: 421614,
    },
    optimismSepolia: {
      url: process.env.OPTIMISM_SEPOLIA_RPC_URL || "",
      accounts,
      chainId: 11155420,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts,
      chainId: 84532,
    },
  },
  etherscan: {
    apiKey:
      process.env.ETHERSCAN_API_KEY ||
      process.env.BASESCAN_API_KEY ||
      process.env.ARBISCAN_API_KEY ||
      process.env.OPTIMISM_API_KEY ||
      "",
    customChains: [
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;
