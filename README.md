# Blockchain Technologies 2 Final Project

Contract slice for a DeFi Super-App scenario. This repo currently covers the smart-contract and deployment ownership area:

- UUPS upgradeable treasury with a V1 -> V2 upgrade path.
- Factory that deploys AMM pairs through both `CREATE` and `CREATE2`.
- Constant-product AMM with 0.3% fee, LP token, slippage checks, and reserve invariant tests.
- `ERC20Votes` + `ERC20Permit` governance token.
- `ERC4626` yield vault.
- `ERC1155` protocol item token.
- Chainlink-compatible price oracle adapter with stale-price checks and mock aggregator.
- OpenZeppelin Governor + TimelockController with 2 day delay, 1 day voting delay, 1 week voting period, 4% quorum, and 1% proposal threshold.
- L2 deployment scripts for Arbitrum Sepolia, Optimism Sepolia, and Base Sepolia.

## Local Commands

```bash
npm install
npm run compile
npm test
```

## Deploy

Copy `.env.example` to `.env`, then fill:

- `DEPLOYER_PRIVATE_KEY`
- one L2 RPC URL, for example `ARBITRUM_SEPOLIA_RPC_URL`
- explorer API key, for example `ARBISCAN_API_KEY`
- optional Chainlink feed addresses. If omitted, the deploy script deploys mock feeds for demos.

Deploy to one L2:

```bash
npm run deploy:arb-sepolia
npm run verify:contracts -- --network arbitrumSepolia
npm run verify:deployment -- --network arbitrumSepolia
```

The deploy script writes addresses to `deployments/<network>.json`.

## Deployment Help Needed

I can run the deploy when you provide:

- an RPC URL for the selected L2 testnet;
- a fresh test wallet private key with test ETH on that L2;
- an explorer API key for verification.

Use a new test wallet only. Do not use a wallet with real funds.
