# DeFi Student Protocol Subgraph

Indexes the Base Sepolia deployment for governance, token movement, AMM activity, ERC4626 vault activity, and ERC1155 item transfers.

## Setup

```bash
cd subgraph
npm install
npm run codegen
npm run build
```

The subgraph is configured for Base Sepolia (`base-sepolia`) and the addresses in `deployments/baseSepolia.json`.

If you know the exact deployment block, replace each `startBlock: 0` in `subgraph.yaml` with that block before hosting. This makes initial indexing much faster.

## Entities

- `TokenTransfer`
- `DelegateChange`
- `Proposal`
- `VoteCast`
- `Swap`
- `LiquidityPosition`
- `VaultDeposit`
- `VaultWithdraw`
- `ItemTransfer`

## Example Queries

Recent governance token transfers:

```graphql
query RecentTransfers {
  tokenTransfers(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
    id
    from
    to
    value
    blockTimestamp
  }
}
```

Proposal list:

```graphql
query Proposals {
  proposals(first: 20, orderBy: blockTimestamp, orderDirection: desc) {
    id
    proposer
    description
    voteStart
    voteEnd
    status
  }
}
```

Votes by latest activity:

```graphql
query Votes {
  voteCasts(first: 20, orderBy: blockTimestamp, orderDirection: desc) {
    proposalId
    voter
    support
    weight
    reason
  }
}
```

AMM swaps:

```graphql
query Swaps {
  swaps(first: 20, orderBy: blockTimestamp, orderDirection: desc) {
    sender
    tokenIn
    to
    amountIn
    amountOut
    feeAmount
  }
}
```

Vault deposits and withdrawals:

```graphql
query VaultActivity {
  vaultDeposits(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
    caller
    owner
    assets
    shares
  }
  vaultWithdraws(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
    caller
    receiver
    owner
    assets
    shares
  }
}
```

ERC1155 item transfers:

```graphql
query Items {
  itemTransfers(first: 20, orderBy: blockTimestamp, orderDirection: desc) {
    operator
    from
    to
    tokenId
    value
  }
}
```

## Frontend Endpoint

After hosting, set the frontend environment variable:

```bash
VITE_SUBGRAPH_URL=https://api.studio.thegraph.com/query/<account>/<subgraph>/<version>
```

If this variable is empty, the frontend shows `Subgraph URL is not configured yet.` and continues running.
