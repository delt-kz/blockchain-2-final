# Frontend Guide

## Stack

- React
- Vite
- TypeScript
- wagmi
- viem
- plain CSS

## Setup

```bash
cd frontend
npm install
npm run dev
```

Build:

```bash
cd frontend
npm run build
```

## Environment

Create `frontend/.env` from `frontend/.env.example`.

```bash
VITE_SUBGRAPH_URL=
```

Leave it empty until a hosted subgraph endpoint exists. The app will show a readable message and continue working.

## Network

The expected network is Base Sepolia:

- Chain ID: `84532`
- RPC: `https://sepolia.base.org`

The app detects wrong networks and asks MetaMask to switch to Base Sepolia.

## Contract Configuration

Addresses live in:

```text
frontend/src/config/contracts.ts
```

Chain configuration lives in:

```text
frontend/src/config/chains.ts
```

Manual proposal IDs live in:

```text
frontend/src/config/proposals.ts
```

## Features

- MetaMask connect and disconnect.
- Connected wallet display.
- Wrong-network warning and switch button.
- DSG balance, voting power, and delegate reads.
- AMM reserve reads.
- Vault total assets, total supply, user shares, USDC balance, and allowance reads.
- Delegate transaction.
- Governor `castVote` transaction with Against, For, and Abstain buttons.
- USDC approval and ERC4626 vault deposit.
- Subgraph GraphQL query page with safe fallback when no URL is configured.
- Readable error messages for rejected transactions, wrong network, insufficient balance, contract reverts, missing wallet, missing subgraph URL, and RPC failures.

## Demo Notes

For the vault deposit demo, the connected wallet needs deployed mock USDC on Base Sepolia. If the wallet has no USDC, the UI still shows balances and allowance, but the deposit transaction will revert or fail for insufficient balance.
