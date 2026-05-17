# Architecture

## Overview

This project is a DeFi student protocol deployed on Base Sepolia. The existing contract layer provides governance, treasury ownership, an AMM pair, an ERC4626 yield vault, ERC1155 protocol items, and oracle support. Part 3 adds a React frontend, a Graph Protocol subgraph, and user-facing documentation without changing the smart contracts.

## Layers

| Layer | Responsibility |
| --- | --- |
| Smart contracts | Protocol logic, governance, vault, AMM, items, oracle, treasury |
| Deployment config | Base Sepolia addresses in `deployments/baseSepolia.json` |
| Frontend | Wallet connection, network guard, protocol reads, governance writes, vault deposit action |
| Subgraph | Event indexing for token, governance, AMM, vault, and item activity |
| Documentation | Setup, architecture, frontend guide, subgraph guide, defense slides |

## Base Sepolia Deployment

| Contract | Address |
| --- | --- |
| Governance token | `0x11Cb8e82cc243Abbb960373E701a10593234A8dA` |
| Timelock | `0x433A20a53036798EEf6E9f99f76fe4D8a334d999` |
| Governor | `0x131B28c5141eff6860312643C44BFEE911AF4A7C` |
| Treasury proxy | `0x517E233f82aCA99855da1868e59c62c053DE1B2B` |
| USDC mock | `0xc57a698eAbb1eE7Fe87C741ea2EC4e860038C069` |
| WETH mock | `0x79E1fBC061bE3B20e8a76bf3bc84FD19F4039E56` |
| Vault | `0xDBCFA9EC3607e94298070202bF29aCeC5799b6af` |
| Items | `0xEDB4203e218795531AC31D1A2bdEc83f8A38A41A` |
| Oracle | `0xd9D6Caa996b8691Ca810545f9Ca04F1fF0Fdf8c4` |
| Pair factory | `0x829aF2859fA5D72b26C54f6467f625a86Ef89B67` |
| AMM pair | `0x45B59F4866A5748721c82db2Cc5149CFc5178dDB` |

## Frontend Flow

The frontend uses Vite, React, TypeScript, wagmi, and viem. Contract addresses are configured in `frontend/src/config/contracts.ts`; Base Sepolia is configured in `frontend/src/config/chains.ts`.

The app has four sections:

- Dashboard: wallet, network, DSG balance, voting power, delegate address, vault state, and AMM reserves.
- Governance: delegate votes and cast Against/For/Abstain votes for proposal IDs configured locally.
- Protocol Actions: approve USDC and deposit into the deployed ERC4626 vault.
- Subgraph Data: query the configured GraphQL endpoint from `VITE_SUBGRAPH_URL`.

## Subgraph Flow

The subgraph reads events from deployed contracts and stores query-friendly entities. It uses artifact ABIs from `artifacts/` and mappings in `subgraph/src/mapping.ts`.

Important entities:

- `TokenTransfer`
- `DelegateChange`
- `Proposal`
- `VoteCast`
- `Swap`
- `LiquidityPosition`
- `VaultDeposit`
- `VaultWithdraw`
- `ItemTransfer`

## Governance Proposal Enumeration

OpenZeppelin Governor does not expose a proposal list by default. The frontend therefore uses `frontend/src/config/proposals.ts` for known proposal IDs. After a proposal is created, add its ID and title there so the UI can read state and cast votes.
