# Smart Contracts Notes

## Requirement Mapping

| Requirement | Implementation |
| --- | --- |
| UUPS upgradeable contract | `ProtocolTreasury` behind `ProtocolProxy`; `ProtocolTreasuryV2` demonstrates upgrade path |
| Factory CREATE / CREATE2 | `PairFactory.createPair` and `PairFactory.createPairDeterministic` |
| AMM from scratch | `DefiSwapPair`, constant product `x*y=k`, 0.3% fee, LP ERC20 |
| ERC20Votes + Permit | `GovernanceToken` |
| ERC4626 | `YieldVault` |
| ERC721 or ERC1155 | `ProtocolItems` |
| Chainlink | `ChainlinkPriceOracle` with `IAggregatorV3` and `MockV3Aggregator` |
| Governance | `ProtocolGovernor` + OpenZeppelin `TimelockController` |
| L2 deployment | `scripts/deploy.ts`, `scripts/verifyContracts.ts`, `scripts/verifyDeployment.ts` |

## UUPS Upgrade Path

`ProtocolTreasury` is initialized through `ProtocolProxy` with the Timelock as admin, treasurer, pauser, and upgrader. `ProtocolTreasuryV2` adds no storage, only new behavior through `pingV2()` and a new `version()` response. Because V2 does not add state variables, the V1 storage layout remains unchanged.

For production deployment, upgrades should be proposed through the Governor, queued in the Timelock, then executed after the 2 day delay by calling `upgradeToAndCall` on the treasury proxy.

## Access Control

The deploy script transfers or assigns privileged powers to the Timelock:

- governance token owner;
- vault owner;
- oracle owner;
- AMM factory owner;
- AMM pair owner;
- treasury admin, treasurer, pauser, and upgrader roles.

The deployer Timelock admin role is revoked at the end of deployment.

## Chainlink Staleness

`ChainlinkPriceOracle.getPrice` reverts when:

- no feed is configured;
- the returned answer is non-positive;
- the answered round is older than the round id;
- `updatedAt` is zero;
- `block.timestamp - updatedAt > staleAfter`.

## Tested Flows

The current test suite covers:

- UUPS V1 -> V2 upgrade;
- AMM factory `CREATE` and `CREATE2`;
- liquidity add, swap, slippage revert, and `k` non-decrease;
- ERC4626 deposit and withdraw;
- vault pause behavior;
- oracle fresh and stale price behavior;
- ERC1155 access-control rejection;
- full Governor propose -> vote -> queue -> execute lifecycle;
- Yul sum matching the pure Solidity sum.
