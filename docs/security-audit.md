# Security Audit Notes

## Summary

The protocol uses OpenZeppelin access control, `ReentrancyGuard`, `SafeERC20`, and timelocked ownership for privileged operations. Slither is configured to fail CI on High or Medium findings:

```bash
npm run slither
```

All production contracts avoid `tx.origin`, randomness from `block.timestamp`, and deprecated ETH `transfer`/`send`. Native ETH release uses `call{value: amount}` and checks `success`.

## CEI and Reentrancy Matrix

| Contract | External function | Protection |
| --- | --- | --- |
| `ProtocolTreasury` | `depositToken` | `nonReentrant`, `whenNotPaused`, `SafeERC20.safeTransferFrom` |
| `ProtocolTreasury` | `releaseNative` | role check, `nonReentrant`, input checks, checked `call{value:}` |
| `ProtocolTreasury` | `releaseToken` | role check, `nonReentrant`, `SafeERC20.safeTransfer` |
| `DefiSwapPair` | `addLiquidity` | `nonReentrant`, input checks, reserve update after token transfers |
| `DefiSwapPair` | `removeLiquidity` | `nonReentrant`, burn/update before outbound transfers |
| `DefiSwapPair` | `swapExactTokensForTokens` | `nonReentrant`, slippage checks, `SafeERC20`, reserve sync |
| `DefiSwapPair` | `sync` | `nonReentrant` |
| `YieldVault` | `deposit`, `mint`, `withdraw`, `redeem` | `nonReentrant`, `whenNotPaused`, ERC4626 accounting |
| `YieldVault` | `reportYield` | `onlyOwner`, `nonReentrant`, `SafeERC20.safeTransferFrom` |
| `ChainlinkPriceOracle` | `getPrice`, `getPrice18` | no state change; validates stale, non-positive, and incomplete rounds |

## Privileged Function Matrix

| Contract | Function | Guard |
| --- | --- | --- |
| `ProtocolTreasury` | `releaseNative`, `releaseToken` | `onlyRole(TREASURER_ROLE)` |
| `ProtocolTreasury` | `pause`, `unpause` | `onlyRole(PAUSER_ROLE)` |
| `ProtocolTreasury` | `_authorizeUpgrade` | `onlyRole(UPGRADER_ROLE)` |
| `GovernanceToken` | `mint` | `onlyOwner` |
| `MockERC20` | `mint` | `onlyOwner`; demo token only |
| `PairFactory` | `setFeeRecipient`, `createPair`, `createPairDeterministic` | `onlyOwner` |
| `DefiSwapPair` | `setFeeRecipient` | `onlyOwner` |
| `YieldVault` | `pause`, `unpause`, `reportYield` | `onlyOwner` |
| `ProtocolItems` | `setURI`, `pause`, `unpause`, `mint`, `mintBatch` | `onlyRole(...)` |
| `ChainlinkPriceOracle` | `setFeed`, `removeFeed` | `onlyOwner` |

## Vulnerability Case Studies

### Reentrancy

Before: `VulnerableNativeVault` in `test/foundry/ProtocolFoundry.t.sol` sends ETH before clearing user balance. `ReentrancyAttacker` reenters `withdraw()` and drains more than the original deposit.

After: `ProtocolTreasury.releaseNative` uses role checks, `nonReentrant`, and checked `call{value:}`. `TreasuryReentryProbe` proves a receiver cannot reenter and drain extra funds.

Tests:

```bash
forge test --match-contract SecurityCaseStudiesTest --match-test Reentrancy
```

### Access Control

Before: `VulnerableAdminRegistry.setAdmin` has no authorization and lets an attacker become admin.

After: production admin operations use `Ownable` or `AccessControl`. The fixed test shows an attacker cannot call `PairFactory.setFeeRecipient`.

Tests:

```bash
forge test --match-contract SecurityCaseStudiesTest --match-test AccessControl
```

## Slither Findings

CI command:

```bash
npm run slither
```

Latest local result with `--fail-medium`: High = 0, Medium = 0. The configured filters exclude dependencies, generated artifacts, and tests so the audit focuses on production contracts.

Known justified informational items:

| Finding | Justification |
| --- | --- |
| `block.timestamp` in `GovernanceToken.clock` | Required by ERC6372 timestamp voting mode; not used as randomness |
| `block.timestamp` in oracle stale-price checks | Time comparison for freshness only; not randomness |
| `AssemblyMath.sumYul` inline assembly | Isolated educational utility; tested against the Solidity implementation |
| `GovernanceToken.CLOCK_MODE` naming | ERC6372 requires this exact uppercase function name |
| `ProtocolTreasury.__gap` naming | OpenZeppelin upgradeable storage-gap convention |
| `PairFactory.predictPairAddress` too-many-digits | Slither prints the long creation-code hash expression; no hard-coded magic numeric literal controls behavior |
| Mock contracts in `contracts/mocks` | Demo/deployment support only; production privileges remain governed by owner/timelock |
