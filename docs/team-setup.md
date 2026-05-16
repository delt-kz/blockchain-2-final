# Team Setup

For normal development, teammates do not need a private key or `.env`.

Use:

```bash
npm install
npm run compile
npm test
```

The deployed Base Sepolia addresses are already committed in:

- `deployments/baseSepolia.json`
- `docs/base-sepolia-deployment.md`

Only the person doing a new deployment needs a local `.env` with:

```env
DEPLOYER_PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

Do not commit `.env`. The deployer account owns the initial governance voting power, so exposing that private key would let someone else control proposals in the demo.
