# Final Requirements Checklist

This checklist maps the rubric to repository evidence.

| Requirement | Status | Evidence |
| --- | --- | --- |
| Smart contract codebase | Done | `contracts/`, `hardhat.config.ts`, `foundry.toml` |
| Unit + fuzz + invariant + fork tests | Done | `test/foundry/ProtocolFoundry.t.sol`, `docs/coverage.md` |
| Frontend dApp | Done | `frontend/` |
| Subgraph config | Done | `subgraph/subgraph.yaml`, `subgraph/schema.graphql`, `subgraph/src/mapping.ts` |
| L2 deploy scripts and verified addresses | Done | `scripts/deploy.ts`, `docs/base-sepolia-deployment.md` |
| Security audit report | Done | `docs/security-audit.md` |
| Architecture document | Done | `docs/ARCHITECTURE.md` |
| Gas optimization report | Done | `docs/gas-benchmarks.md` |
| README | Done | `README.md` |
| Presentation PDF | Done | `docs/presentation/final-presentation.pdf` |
| UUPS V1 -> V2 | Done | `ProtocolTreasury`, `ProtocolTreasuryV2`, tests |
| Factory CREATE + CREATE2 | Done | `PairFactory`, tests |
| Inline Yul benchmark | Done | `AssemblyMath`, `docs/gas-benchmarks.md` |
| ERC20Votes + ERC20Permit | Done | `GovernanceToken` |
| ERC1155 | Done | `ProtocolItems` |
| ERC4626 | Done | `YieldVault` |
| AMM x*y=k | Done | `DefiSwapPair` |
| Chainlink stale checks | Done | `ChainlinkPriceOracle`, `MockV3Aggregator`, tests |
| Subgraph 4+ entities and 5 queries | Done | `subgraph/README.md` |
| Governor + Timelock settings | Done | `ProtocolGovernor`, `deployments/baseSepolia.json` |
| Base Sepolia deployment + verification | Done | `docs/base-sepolia-deployment.md` |
| Slither High/Medium gate | Done in CI config | `.github/workflows/contracts.yml`, `slither.config.json` |
| Reentrancy and access-control case studies | Done | `testCaseStudy001` through `testCaseStudy004` |
| Frontend wallet connect | Done | `frontend/src/components/WalletConnect.tsx` |
| Frontend reads | Done | `frontend/src/hooks/` |
| Frontend 3 writes | Done | delegate, approve/deposit, cast vote |
| Proposal state + vote button | Done | `frontend/src/config/proposals.ts`, `ProposalCard.tsx` |
| Subgraph frontend page | Done | `frontend/src/pages/SubgraphData.tsx` |
| Wrong-network detection | Done | `NetworkGuard.tsx` |
| CI on push and PR | Done | `.github/workflows/contracts.yml` |
| Prettier frontend lint in CI | Done | `lint:frontend` |

Known operational note: the subgraph is buildable and configured, but hosting it on The Graph Studio still requires a team Graph deploy key and endpoint. After hosting, set `VITE_SUBGRAPH_URL` for the frontend demo.
