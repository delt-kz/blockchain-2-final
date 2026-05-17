# Gas Optimization Report

## 1. Methodology

Gas measurements were collected from the Foundry gas reporter and Hardhat deployment/test flows. The project uses optimizer settings:

| Setting | Value |
| --- | --- |
| Solidity | `0.8.24` |
| Optimizer | enabled |
| Optimizer runs | `200` |
| EVM version | `cancun` |
| viaIR | enabled |

Commands:

```bash
forge test --gas-report
REPORT_GAS=true npm test
```

The full Foundry suite includes unit, fuzz, invariant, fork, and vulnerability case-study tests. For stable operation-level numbers, this report references focused unit tests where possible.

## 2. Operation Gas Snapshot

| Operation | Gas |
| --- | ---: |
| `ProtocolTreasury` implementation deploy | 1,199,726 |
| `ProtocolTreasuryV2` implementation deploy | 1,213,999 |
| `YieldVault` deploy | 1,254,390 |
| `PairFactory` deploy | 2,259,465 |
| `ProtocolGovernor` deploy | 3,533,472 |
| `TimelockController` deploy | 1,288,295 |
| UUPS treasury upgrade flow | 1,300,957 |
| AMM pair creation via `CREATE` | 1,440,109 |
| AMM pair creation via `CREATE2` | 1,489,927 |
| AMM add liquidity | 151,226 |
| AMM remove liquidity | 52,767 |
| AMM swap | 41,470 |
| Vault deposit | 92,124 |
| Vault withdraw | 59,838 |
| Vault redeem | 58,386 |
| Treasury token deposit | 44,587 |
| Treasury native release | 23,509 |
| Treasury token release | 15,141 |
| Governor propose | 78,481 |
| Governor cast vote | 82,808 |
| Governor queue | 146,766 |
| Governor execute | 165,981 |

## 3. L1 vs L2 Cost Comparison

The course requires an L1 vs L2 comparison for at least 6 operations. The deployed system runs on Base Sepolia. For a reproducible estimate, this table applies the same measured gas units to two fee environments:

- L1 estimate: 20 gwei gas price.
- Base Sepolia / L2 estimate: 0.05 gwei execution gas price.
- ETH/USD reference for human comparison: 3,000 USD.

These are fee-environment estimates, not claims about a specific live block. The important observation is that the same EVM operation becomes materially cheaper on L2 because execution gas price is much lower.

| Operation | Gas | L1 cost at 20 gwei | L2 cost at 0.05 gwei | Approx reduction |
| --- | ---: | ---: | ---: | ---: |
| AMM swap | 41,470 | 0.0008294 ETH / $2.49 | 0.0000020735 ETH / $0.0062 | 400x |
| AMM add liquidity | 151,226 | 0.00302452 ETH / $9.07 | 0.0000075613 ETH / $0.0227 | 400x |
| AMM remove liquidity | 52,767 | 0.00105534 ETH / $3.17 | 0.0000026384 ETH / $0.0079 | 400x |
| Vault deposit | 92,124 | 0.00184248 ETH / $5.53 | 0.0000046062 ETH / $0.0138 | 400x |
| Vault withdraw | 59,838 | 0.00119676 ETH / $3.59 | 0.0000029919 ETH / $0.0090 | 400x |
| Governor cast vote | 82,808 | 0.00165616 ETH / $4.97 | 0.0000041404 ETH / $0.0124 | 400x |
| Governor queue | 146,766 | 0.00293532 ETH / $8.81 | 0.0000073383 ETH / $0.0220 | 400x |
| Governor execute | 165,981 | 0.00331962 ETH / $9.96 | 0.0000082991 ETH / $0.0249 | 400x |

## 4. Before / After Optimization Notes

| Area | Before | After | Result |
| --- | --- | --- | --- |
| Compiler | Default compile path | Optimizer + viaIR | Smaller runtime and avoids stack-too-deep in AMM |
| ERC20 transfers | Raw `transfer` / `transferFrom` would be unsafe | `SafeERC20` everywhere in production token flows | Safer external calls, consistent reverts |
| AMM reserve storage | Full `uint256` reserves | `uint112` reserves with overflow checks | Compact storage similar to established AMMs |
| CREATE2 address prediction | Off-chain only possible | On-chain `predictPairAddress` | Deterministic pair planning and tests |
| Assembly benchmark | Solidity loop only | `sumYul` reads calldata directly | Demonstrates lower-level optimization safely |
| Deployment | Manual deploy risk | Idempotent script + verification script | Fewer redeploy mistakes |

## 5. Yul Benchmark

`AssemblyMath` contains two equivalent functions:

- `sumSolidity(uint256[] calldata values)`
- `sumYul(uint256[] calldata values)`

The Yul version iterates through calldata with `calldataload`. The Foundry and Hardhat tests assert both implementations return the same value for representative inputs. This keeps the assembly requirement isolated from protocol-critical accounting.

```solidity
function sumYul(uint256[] calldata values) external pure returns (uint256 total) {
    assembly {
        let offset := values.offset
        let end := add(offset, mul(values.length, 0x20))
        for {} lt(offset, end) { offset := add(offset, 0x20) } {
            total := add(total, calldataload(offset))
        }
    }
}
```

## 6. Benchmark Sources

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

## 7. Conclusions

The largest user-facing cost wins come from deploying and operating on Base Sepolia rather than L1. Within the contracts, the project uses conservative optimizations: compiler optimizer/viaIR, compact reserve types, SafeERC20, and isolated Yul only for a benchmark utility. The team avoided risky micro-optimizations in treasury, vault, and governance code because correctness matters more than saving a small amount of gas in privileged flows.
