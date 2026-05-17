# Defense Slides

## Slide 1: Project Overview

DeFi Student Protocol combines governance, a timelocked treasury, ERC20Votes, an ERC4626 vault, an AMM pair, ERC1155 items, and oracle support on Base Sepolia.

## Slide 2: My Ownership

Frontend + Subgraph + Documentation.

Delivered:

- React + Vite + TypeScript app.
- wagmi/viem wallet and contract integration.
- Governance delegation and voting.
- ERC4626 vault deposit flow.
- Graph Protocol subgraph.
- Architecture, frontend, subgraph, and README documentation.

## Slide 3: Frontend Demo

Show:

- MetaMask connect.
- Base Sepolia network detection.
- Wrong-network switch button.
- Dashboard reads: token balance, voting power, delegate, vault state, AMM reserves.

## Slide 4: Governance Demo

Show:

- Delegate votes.
- Proposal cards from `frontend/src/config/proposals.ts`.
- Proposal state text.
- Against, For, Abstain vote buttons.

## Slide 5: Protocol Action Demo

Show:

- USDC balance and vault allowance.
- Approve USDC.
- Deposit into the ERC4626 vault.
- Updated vault shares after confirmation.

## Slide 6: Subgraph Demo

Show:

- `subgraph/schema.graphql`.
- `subgraph/src/mapping.ts`.
- `npm run codegen`.
- `npm run build`.
- Frontend Subgraph Data page with either indexed data or the configured fallback message.

## Slide 7: Error Handling

Readable handling for:

- User rejected transaction.
- Wrong network.
- Insufficient balance.
- Contract revert.
- Wallet not connected.
- Missing subgraph URL.
- RPC or fetch failure.

## Slide 8: Verification

Commands:

```bash
npm run compile
npm test
npm run forge:build
npm run forge:test
cd frontend && npm run build
cd subgraph && npm run build
```

## Slide 9: What Is Not Changed

Smart contracts and existing tests were not rewritten for Part 3. The frontend and subgraph consume the deployed contract interfaces.
