# Gas Benchmarks

Gas benchmarking commands:

```bash
forge test --gas-report
REPORT_GAS=true npm test
```

Snapshot command used for this report:

```bash
forge test --match-contract ProtocolUnitTest --gas-report
```

The full suite contains fuzz and invariant tests, so the focused unit-test gas report is used for stable
operation-level numbers.

## Snapshot

| Operation | Gas |
| --- | ---: |
| `ProtocolTreasury` implementation deploy | 1,199,726 |
| `ProtocolTreasuryV2` implementation deploy | 1,213,999 |
| `YieldVault` deploy | 1,254,390 |
| `PairFactory` deploy | 2,259,465 |
| `ProtocolGovernor` deploy | 3,533,472 |
| `TimelockController` deploy | 1,288,295 |
| UUPS treasury upgrade test flow | 1,300,957 |
| AMM pair creation via `createPair` avg | 1,440,109 |
| AMM pair creation via CREATE2 avg | 1,489,927 |
| AMM add liquidity avg | 151,226 |
| AMM remove liquidity avg | 52,767 |
| AMM swap avg | 41,470 |
| Vault deposit avg | 92,124 |
| Vault withdraw avg | 59,838 |
| Vault redeem avg | 58,386 |
| Treasury token deposit avg | 44,587 |
| Treasury native release avg | 23,509 |
| Treasury token release avg | 15,141 |
| Governor propose | 78,481 |
| Governor cast vote | 82,808 |
| Governor queue | 146,766 |
| Governor execute | 165,981 |
| Full governor queue/execute test flow | 805,061 |

## Test Sources

| Operation | Benchmark source |
| --- | --- |
| UUPS treasury deploy and V1 -> V2 upgrade | `ProtocolUnitTest.test027TreasuryUpgradesToV2` |
| Treasury token deposit | `ProtocolFuzzTest.testFuzz007TreasuryTokenDeposit` |
| Treasury native release | `ProtocolUnitTest.test018TreasuryReleasesNativeWithCall` |
| AMM pair creation | `ProtocolUnitTest.test030FactoryCreatesNormalPair` |
| AMM CREATE2 pair creation | `ProtocolUnitTest.test031FactoryCreatesDeterministicPairAtPrediction` |
| AMM add liquidity | `ProtocolUnitTest.test044PairAddsInitialLiquidity` |
| AMM remove liquidity | `ProtocolUnitTest.test055PairRemovesLiquidity` |
| AMM swap | `ProtocolUnitTest.test051PairSwapsAndKeepsKNonDecreasing` |
| Vault deposit/withdraw/redeem | `ProtocolUnitTest.test059` through `test062` |
| Governance parameters and voting power | `ProtocolUnitTest.test009`, `ProtocolFuzzTest.testFuzz006GovernanceVotingPower` |
