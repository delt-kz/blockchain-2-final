# Coverage Report

Coverage is measured with Foundry and gated by `scripts/checkForgeCoverage.js`:

```bash
npm run forge:coverage
```

The CI threshold is line coverage >= 90% across `contracts/`. The Foundry suite in
`test/foundry/ProtocolFoundry.t.sol` covers the protocol with:

| Test category | Count |
| --- | ---: |
| Unit tests | 88 |
| Fuzz tests | 10 |
| Invariant tests | 5 |
| Fork tests | 3 |
| Vulnerability before/after tests | 4 |

Current Foundry coverage gate:

| Metric | Required |
| --- | ---: |
| Lines | 98.57% |
| Scope | `contracts/` |
| Command | `forge coverage --report lcov && node scripts/checkForgeCoverage.js lcov.info 90` |

Fork tests read `MAINNET_RPC_URL`. Without that variable, the fork assertions self-skip so local and CI
unit/fuzz/invariant coverage can still run deterministically.
