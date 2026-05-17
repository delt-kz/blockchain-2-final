# Subgraph Guide

## Setup

```bash
cd subgraph
npm install
npm run codegen
npm run build
```

## Files

| File | Purpose |
| --- | --- |
| `subgraph/subgraph.yaml` | Data sources, addresses, ABIs, and event handlers |
| `subgraph/schema.graphql` | Indexed entity schema |
| `subgraph/src/mapping.ts` | Event-to-entity mapping logic |
| `subgraph/abis/` | Contract ABI artifacts used by Graph codegen |
| `subgraph/README.md` | Query examples and hosting notes |

## Indexed Contracts

| Contract | Events |
| --- | --- |
| Governance token | `Transfer`, `DelegateChanged` |
| Governor | `ProposalCreated`, `ProposalQueued`, `ProposalCanceled`, `ProposalExecuted`, `VoteCast` |
| AMM pair | `Swap`, `LiquidityAdded`, `LiquidityRemoved` |
| Yield vault | `Deposit`, `Withdraw` |
| Protocol items | `TransferSingle` |

## Hosting

The subgraph is ready for local codegen/build. Hosting is optional for this part. After hosting, copy the GraphQL URL into:

```bash
frontend/.env
```

```bash
VITE_SUBGRAPH_URL=<hosted-subgraph-url>
```

## Start Block

`subgraph.yaml` currently uses `startBlock: 0` because the exact deployment block is not stored in `deployments/baseSepolia.json`. Before production hosting, replace each `startBlock` with the actual deployment block to speed up indexing.

## Query Examples

See `subgraph/README.md` for more than five ready-to-run GraphQL queries, including transfers, proposals, votes, swaps, vault activity, and item transfers.
