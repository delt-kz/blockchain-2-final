# Blockchain Technologies 2 Final Project

DeFi Super-App protocol with smart contracts, deployment tooling, security documentation, CI, a frontend, and a subgraph. The deployed Base Sepolia system includes governance, a timelocked treasury, ERC20Votes, an ERC4626 vault, an AMM pair, ERC1155 items, and oracle support.

- UUPS upgradeable treasury with a V1 -> V2 upgrade path.
- Factory that deploys AMM pairs through both `CREATE` and `CREATE2`.
- Constant-product AMM with 0.3% fee, LP token, slippage checks, and reserve invariant tests.
- `ERC20Votes` + `ERC20Permit` governance token.
- `ERC4626` yield vault.
- `ERC1155` protocol item token.
- Chainlink-compatible price oracle adapter with stale-price checks and mock aggregator.
- OpenZeppelin Governor + TimelockController with 2 day delay, 1 day voting delay, 1 week voting period, 4% quorum, and 1% proposal threshold.
- L2 deployment scripts for Arbitrum Sepolia, Optimism Sepolia, and Base Sepolia.
- React frontend for wallet connection, protocol reads, governance actions, and vault deposit.
- Graph Protocol subgraph for protocol event indexing.

## Team Ownership

| Area | Owner |
| --- | --- |
| Smart contracts, deployment, tests, security docs, CI | Existing team implementation |
| Frontend + Subgraph + Docs | Nurasyl |

## Base Sepolia Deployment

Network: Base Sepolia

Chain ID: `84532`

| Contract | Address |
| --- | --- |
| Governance token | `0x11Cb8e82cc243Abbb960373E701a10593234A8dA` |
| Timelock | `0x433A20a53036798EEf6E9f99f76fe4D8a334d999` |
| Governor | `0x131B28c5141eff6860312643C44BFEE911AF4A7C` |
| Treasury proxy | `0x517E233f82aCA99855da1868e59c62c053DE1B2B` |
| USDC | `0xc57a698eAbb1eE7Fe87C741ea2EC4e860038C069` |
| WETH | `0x79E1fBC061bE3B20e8a76bf3bc84FD19F4039E56` |
| Vault | `0xDBCFA9EC3607e94298070202bF29aCeC5799b6af` |
| Items | `0xEDB4203e218795531AC31D1A2bdEc83f8A38A41A` |
| Oracle | `0xd9D6Caa996b8691Ca810545f9Ca04F1fF0Fdf8c4` |
| Pair factory | `0x829aF2859fA5D72b26C54f6467f625a86Ef89B67` |
| AMM pair | `0x45B59F4866A5748721c82db2Cc5149CFc5178dDB` |

## Local Commands

```bash
npm install
npm run compile
npm test
npm run forge:build
npm run forge:test
npm run forge:coverage
npm run lint:sol
npm run slither
```

`forge` and `slither` are installed in CI. For local security/fork runs, install Foundry and Slither first, then set `MAINNET_RPC_URL` if you want the three fork integration assertions to execute instead of self-skipping.

## Deploy

Copy `.env.example` to `.env`, then fill at minimum:

- `DEPLOYER_PRIVATE_KEY`

For Base Sepolia, `BASE_SEPOLIA_RPC_URL=https://sepolia.base.org` is already enough for a basic deployment.

For verified source code on the explorer, also fill:

- `ETHERSCAN_API_KEY` is preferred because Hardhat Verify uses Etherscan API v2.

Chainlink feed addresses are optional. If omitted, the deploy script deploys mock feeds for demos.

Deploy to one L2:

```bash
npm run deploy:arb-sepolia
npx hardhat run scripts/verifyContracts.ts --network arbitrumSepolia
npx hardhat run scripts/verifyDeployment.ts --network arbitrumSepolia
```

For the committed Base Sepolia deployment:

```bash
npm run verify:contracts:base-sepolia
npm run verify:deployment:base-sepolia
```

The deploy script writes addresses to `deployments/<network>.json`. If a valid deployment file already exists and all required addresses have bytecode, the script reuses it. Set `FORCE_DEPLOY=true` to redeploy from scratch.

Current Base Sepolia deployment and verified BaseScan links are documented in `docs/base-sepolia-deployment.md`.

Post-deployment verification output is documented in `docs/deployment-verification-output.md`.

The committed demo proposal is configured in `frontend/src/config/proposals.ts`.

The final presentation PDF is available at `docs/presentation/final-presentation.pdf`.

## Frontend

```bash
cd frontend
npm install
npm run dev
npm run build
```

Addresses are configured in `frontend/src/config/contracts.ts`.

Base Sepolia is configured in `frontend/src/config/chains.ts`.

If a hosted subgraph exists, create `frontend/.env`:

```bash
VITE_SUBGRAPH_URL=<hosted-subgraph-url>
```

If the value is empty, the app shows `Subgraph URL is not configured yet.` and does not crash.

## Subgraph

```bash
cd subgraph
npm install
npm run codegen
npm run build
```

The subgraph indexes real events from the deployed governance token, governor, AMM pair, ERC4626 vault, and ERC1155 items contract. See `subgraph/README.md` for GraphQL queries.

## Part 3 Checklist

| Requirement | Status |
| --- | --- |
| Wallet connect | Done |
| Network detection | Done |
| Token balance read | Done |
| Voting power read | Done |
| Delegate address read | Done |
| Protocol state read | Done |
| 3 write actions | Done: delegate, vote, vault approve/deposit |
| Proposal list | Done with manual `frontend/src/config/proposals.ts` |
| Vote buttons | Done |
| Subgraph data section | Done |
| Readable errors | Done |
| README | Done |
| Architecture doc | Done |
| Frontend guide | Done |
| Subgraph guide | Done |
| Slides | Done |

