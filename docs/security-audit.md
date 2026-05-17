# Internal Security Audit Report

## 1. Executive Summary

This report covers the DeFi Student Protocol contracts deployed on Base Sepolia for the Blockchain Technologies 2 final project. The review focused on authorization, upgradeability, token accounting, AMM invariants, ERC4626 flows, oracle freshness, governance controls, and deployment correctness.

Overall assessment: the protocol is appropriate for a testnet educational capstone. The design uses OpenZeppelin primitives for the highest-risk areas: Governor, TimelockController, ERC20Votes, ERC20Permit, ERC4626, ERC1155, Ownable, AccessControl, Pausable, ReentrancyGuard, SafeERC20, ERC1967 proxy, and UUPS. Privileged powers are transferred to Timelock in the committed Base Sepolia deployment, and a post-deployment verification script confirms that no deployer Timelock admin remains.

The project is not mainnet-ready without additional production work. The deployed assets are mocks, the subgraph endpoint must be hosted by the team, and the governance token distribution is centralized in the initial test wallet for demo purposes. These are acceptable for the course demo but must be documented.

## 2. Scope

### Commit

Scope should be evaluated at the final submission commit. At the time this report was updated, the local branch included the CI/frontend/subgraph fixes and expanded documentation.

### Contracts In Scope

| File | Purpose |
| --- | --- |
| `contracts/tokens/GovernanceToken.sol` | ERC20Votes + ERC20Permit governance token |
| `contracts/governance/ProtocolGovernor.sol` | OpenZeppelin Governor configuration |
| `contracts/upgradeable/ProtocolTreasury.sol` | UUPS upgradeable treasury |
| `contracts/upgradeable/ProtocolTreasuryV2.sol` | Upgrade path demonstration |
| `contracts/proxy/ProtocolProxy.sol` | ERC1967 proxy wrapper |
| `contracts/amm/PairFactory.sol` | CREATE and CREATE2 AMM pair deployment |
| `contracts/amm/DefiSwapPair.sol` | Constant-product AMM and LP token |
| `contracts/vault/YieldVault.sol` | ERC4626 tokenized vault |
| `contracts/tokens/ProtocolItems.sol` | ERC1155 protocol item token |
| `contracts/oracle/ChainlinkPriceOracle.sol` | Chainlink-compatible oracle adapter |
| `contracts/utils/AssemblyMath.sol` | Inline Yul benchmark utility |
| `contracts/mocks/*.sol` | Testnet/demo mock tokens and price feeds |

### Out of Scope

| Area | Reason |
| --- | --- |
| Base Sepolia consensus/security | External network dependency |
| MetaMask wallet security | User wallet dependency |
| Hosted Graph infrastructure | External indexing infrastructure |
| RPC provider uptime | External provider dependency |
| Mock token economic value | Testnet-only demo assets |

## 3. Methodology

The review used a combination of automated tooling and manual review:

- Hardhat compilation and TypeScript checks.
- Hardhat unit tests for main protocol flows.
- Foundry unit, fuzz, invariant, fork, and vulnerability case-study tests.
- Slither static analysis configured with `--fail-medium`.
- Manual review of privileged functions and external calls.
- Manual review of deployment output and BaseScan verification links.
- Manual review of CEI/ReentrancyGuard usage.
- Manual review of oracle staleness behavior.
- Manual review of governance lifecycle and Timelock ownership.

Primary commands:

```bash
npm run compile
npm test
npm run forge:test
npm run forge:coverage
npm run slither
npm run verify:deployment:base-sepolia
```

## 4. Findings Summary

| ID | Severity | Title | Status |
| --- | --- | --- | --- |
| H-01 | High | Unrestricted admin setter in case-study vulnerable registry | Fixed in production design |
| H-02 | High | Reentrancy in case-study vulnerable native vault | Fixed in production design |
| M-01 | Medium | Deployer could retain Timelock admin after deployment | Fixed by deploy script and verification |
| M-02 | Medium | Oracle consumers could accept stale price data | Fixed by `staleAfter` checks |
| L-01 | Low | Governance token distribution centralized for demo | Acknowledged |
| L-02 | Low | Mock feeds used for Base Sepolia demo | Acknowledged |
| L-03 | Low | Frontend proposal list requires known proposal IDs | Acknowledged |
| I-01 | Informational | `block.timestamp` used for ERC6372 and staleness | Justified |
| I-02 | Informational | Inline assembly in utility contract | Justified |
| G-01 | Gas | Yul sum utility cheaper than Solidity loop for large arrays | Demonstrated |

## 5. Detailed Findings

### H-01: Unrestricted Admin Setter in Vulnerable Case Study

Severity: High  
Location: `test/foundry/ProtocolFoundry.t.sol`, vulnerable case-study helper  
Status: Fixed in production design

Description: The reproduced vulnerable contract `VulnerableAdminRegistry` exposes `setAdmin` without any authorization. Any address can become admin.

Impact: A malicious user could take ownership of privileged configuration and redirect protocol settings.

Proof of Concept: `testCaseStudy003AccessControlBeforeExploitReproduced` demonstrates an attacker becoming admin.

Recommendation: All privileged state changes must use `Ownable`, `AccessControl`, or Timelock-controlled governance.

Resolution: Production contracts use `onlyOwner` or `onlyRole`. The fixed test `testCaseStudy004AccessControlAfterFixedByOnlyOwner` proves unauthorized callers cannot change `PairFactory` fee recipient.

### H-02: Reentrancy in Vulnerable Native Vault Case Study

Severity: High  
Location: `test/foundry/ProtocolFoundry.t.sol`, vulnerable case-study helper  
Status: Fixed in production design

Description: The reproduced vulnerable vault sends ETH before clearing the user balance. A receiver can reenter and withdraw repeatedly.

Impact: ETH can be drained beyond the attacker's legitimate balance.

Proof of Concept: `testCaseStudy001ReentrancyBeforeExploitReproduced` demonstrates the exploit.

Recommendation: Use Checks-Effects-Interactions and `ReentrancyGuard`. Update accounting before external calls.

Resolution: `ProtocolTreasury.releaseNative` uses role checks, `nonReentrant`, input validation, and checked `call{value:}`. `testCaseStudy002ReentrancyAfterFixedByTreasuryGuardAndRoles` demonstrates the fixed behavior.

### M-01: Deployer Could Retain Timelock Admin After Deployment

Severity: Medium  
Location: Deployment process  
Status: Fixed

Description: If the deployer remains Timelock admin, governance can be bypassed.

Impact: The deployer could grant roles or execute privileged actions without a vote.

Proof of Concept: This is a deployment-risk finding rather than a Solidity bug. A misconfigured Timelock admin role would be visible through `hasRole(DEFAULT_ADMIN_ROLE, deployer)`.

Recommendation: Revoke deployer admin after granting proposer/canceller/executor roles.

Resolution: `scripts/deploy.ts` revokes deployer admin. `scripts/verifyDeployment.ts` checks `deployer no longer has timelock admin` and that Timelock self-admin remains.

### M-02: Oracle Consumers Could Accept Stale Price Data

Severity: Medium  
Location: `ChainlinkPriceOracle.getPrice`  
Status: Fixed

Description: Oracle reads must reject stale rounds. Without this, protocol decisions could use outdated prices.

Impact: A stale feed can mislead users or downstream integrations.

Proof of Concept: `test077OracleRejectsStalePrice` sets an old `updatedAt` value and expects a revert.

Recommendation: Store a per-feed staleness window and compare `block.timestamp - updatedAt`.

Resolution: `ChainlinkPriceOracle` reverts with `StalePrice` when feed data is older than `staleAfter`.

### L-01: Governance Token Distribution Centralized for Demo

Severity: Low  
Location: Deployment  
Status: Acknowledged

Description: The deployer received the initial governance supply for demonstration. This centralizes proposal creation and voting power.

Impact: The demo wallet can dominate governance until tokens are distributed.

Recommendation: For production, distribute voting power through a transparent allocation, vesting, or claim process.

Status: Acknowledged for testnet capstone. The risk is documented for defense.

### L-02: Mock Feeds Used for Base Sepolia Demo

Severity: Low  
Location: `MockV3Aggregator` deployment  
Status: Acknowledged

Description: The Base Sepolia deployment uses Chainlink-compatible mock feeds when real feed env vars are not provided.

Impact: Mock values are not economically meaningful.

Recommendation: Use official Chainlink feeds for production assets.

Status: Acknowledged. The mock feed still demonstrates interface integration, decimal scaling, and stale-price rejection.

### L-03: Frontend Proposal List Requires Known Proposal IDs

Severity: Low  
Location: `frontend/src/config/proposals.ts`  
Status: Acknowledged

Description: OpenZeppelin Governor does not expose proposal enumeration. The frontend uses configured proposal IDs and subgraph indexing.

Impact: If a proposal ID is not configured or indexed, the UI will not show it.

Recommendation: A production frontend should use the subgraph as the primary proposal list and keep manual config only as a fallback.

Status: A demo proposal has been created and added to config.

### I-01: `block.timestamp` Usage

Severity: Informational  
Location: `GovernanceToken.clock`, `ChainlinkPriceOracle`, mocks  
Status: Justified

Description: `block.timestamp` appears in the codebase.

Impact: `block.timestamp` is unsafe for randomness, but the project does not use it as randomness.

Justification: ERC6372 timestamp voting mode requires timestamp-based clock behavior. Oracle freshness checks must compare timestamps. Mocks use timestamps to simulate aggregator rounds.

### I-02: Inline Assembly Utility

Severity: Informational  
Location: `AssemblyMath.sumYul`  
Status: Justified

Description: Inline Yul can be riskier than Solidity.

Impact: Incorrect assembly can bypass Solidity safety checks.

Justification: The assembly utility is stateless, isolated, and tested against the Solidity equivalent. It exists to satisfy the lecture requirement and benchmark assembly against pure Solidity.

### G-01: Yul Sum Gas Optimization

Severity: Gas  
Location: `AssemblyMath`  
Status: Demonstrated

Description: `sumYul` iterates over calldata directly with `calldataload`, avoiding some Solidity loop overhead.

Impact: For larger arrays, Yul can reduce gas. The optimization is intentionally isolated so it does not compromise protocol-critical accounting.

Recommendation: Keep Yul limited to small, well-tested utilities.

## 6. CEI and Reentrancy Review

| Contract | External function | Protection |
| --- | --- | --- |
| `ProtocolTreasury` | `depositToken` | `nonReentrant`, `whenNotPaused`, `SafeERC20.safeTransferFrom` |
| `ProtocolTreasury` | `releaseNative` | role check, `nonReentrant`, checked `call{value:}` |
| `ProtocolTreasury` | `releaseToken` | role check, `nonReentrant`, `SafeERC20.safeTransfer` |
| `DefiSwapPair` | `addLiquidity` | `nonReentrant`, input checks, reserve sync |
| `DefiSwapPair` | `removeLiquidity` | `nonReentrant`, burn/update before outbound transfers |
| `DefiSwapPair` | `swapExactTokensForTokens` | `nonReentrant`, slippage checks, SafeERC20, reserve sync |
| `YieldVault` | `deposit`, `mint`, `withdraw`, `redeem` | `nonReentrant`, `whenNotPaused`, ERC4626 accounting |
| `YieldVault` | `reportYield` | `onlyOwner`, `nonReentrant`, `SafeERC20.safeTransferFrom` |
| `ProtocolItems` | mint/URI/pause functions | role checks |
| `ChainlinkPriceOracle` | feed admin functions | `onlyOwner` |

No production contract uses `tx.origin`. No production contract uses ETH `transfer` or `send`.

## 7. Privileged Function Review

| Contract | Function | Guard | Final admin |
| --- | --- | --- | --- |
| `GovernanceToken` | `mint` | `onlyOwner` | Timelock |
| `ProtocolTreasury` | release/pause/upgrade | `onlyRole` | Timelock |
| `PairFactory` | create pair, set fee recipient | `onlyOwner` | Timelock |
| `DefiSwapPair` | set fee recipient | `onlyOwner` | Timelock |
| `YieldVault` | pause, unpause, reportYield | `onlyOwner` | Timelock |
| `ProtocolItems` | mint, batch mint, URI, pause | `onlyRole` | Timelock roles |
| `ChainlinkPriceOracle` | set/remove feed | `onlyOwner` | Timelock |

The post-deployment verification script checks these final ownership assumptions on Base Sepolia.

## 8. Governance Attack Analysis

### Flash-loan governance attacks

The governance token uses `ERC20Votes`, which snapshots voting power through checkpoints. A voter must have voting power at the relevant timepoint. This reduces the feasibility of borrowing tokens only for the voting transaction. A production protocol should also monitor token liquidity and distribution.

### Whale attacks

The demo distribution is centralized, so whale risk is acknowledged. The protocol mitigates sudden execution through a 2 day Timelock delay, but it does not prevent a token majority from passing proposals. Production mitigation would require broader token distribution, delegation campaigns, vote caps, or additional governance design.

### Proposal spam

The Governor has a 1% proposal threshold. With a 1,000,000 token initial supply, proposal creation requires 10,000 delegated votes. This prevents addresses with no voting power from spamming proposals.

### Timelock bypass

The deployer Timelock admin role is revoked. Timelock is self-administered and Governor is proposer/canceller. Executor is open, which is acceptable because only already-scheduled operations can be executed after delay.

### Malicious proposal execution

A malicious proposal can still pass if voters approve it. The 2 day delay gives observers time to notice queued changes and react socially before execution.

## 9. Oracle Attack Analysis

### Stale price

Mitigation: `ChainlinkPriceOracle` rejects answers where `block.timestamp - updatedAt > staleAfter`.

### Negative or zero price

Mitigation: `getPrice` reverts when `answer <= 0`.

### Incomplete round

Mitigation: `getPrice` reverts when `answeredInRound < roundId`.

### Feed depeg or wrong feed

Risk: A feed can report a valid but economically wrong value, or admin can configure the wrong feed.  
Mitigation: feed updates are owner-controlled and, after deployment, owner is Timelock. Production should use official Chainlink feeds and verify feed addresses in deployment review.

### Price manipulation

Chainlink-style feeds reduce direct AMM spot-price manipulation risk. The current AMM does not use the oracle for settlement, so oracle risk is isolated to integrations and frontend reads.

## 10. Centralization Analysis

The strongest centralization risk is initial voting power. The deployer received demo governance tokens and created the first proposal. This makes the testnet demo easy to operate but is not production decentralization.

The best decentralization property is that privileged protocol controls are no longer held directly by the deployer. Timelock owns the major contracts, and upgrades must pass through governance and delay.

If the demo wallet is compromised, an attacker could use its voting power to pass proposals. They still cannot execute instantly because Timelock delay applies. If the frontend maintainer is compromised, users may be shown malicious prompts, but wallet confirmation and contract-level authorization remain the final line of defense.

## 11. Slither Appendix

Configured command:

```bash
npm run slither
```

CI installs Foundry before running Slither because Slither uses the Foundry config to compile the project. The configuration filters dependencies, generated artifacts, tests, and local forge-std libraries:

```json
{
  "filter_paths": "node_modules|artifacts|cache|coverage|typechain-types|test|lib",
  "exclude_dependencies": true,
  "fail_on": "medium"
}
```

Expected submission result: zero High and zero Medium findings. Low and informational findings are documented above and justified when relevant.

## 12. Residual Risks

| Risk | Severity | Handling |
| --- | --- | --- |
| Mock assets and feeds | Low | Testnet-only; documented |
| Manual proposal config | Low | Demo proposal committed; subgraph should become source of truth |
| Subgraph hosted endpoint depends on team account | Low/Medium | Build verified; hosting requires Graph Studio deploy key |
| Initial voting power centralized | Low for class, High for production | Acknowledged, not mainnet-ready |
| No professional external audit | Medium | Internal audit only, as required by course |

## 13. Conclusion

The reviewed system demonstrates the required security patterns for a course capstone: controlled admin functions, Timelock governance, UUPS upgrade authorization, reentrancy protection, SafeERC20 usage, oracle freshness validation, and vulnerability case studies. The remaining risks are primarily operational and demo-related rather than direct Solidity vulnerabilities.

## 14. Per-Contract Manual Review Notes

### `GovernanceToken`

The token uses OpenZeppelin ERC20Votes and ERC20Permit. Minting is owner-gated and capped by `MAX_SUPPLY`. The deployment transfers ownership to Timelock, so new minting requires governance. The timestamp clock is explicit and documented through `CLOCK_MODE`, which aligns with ERC6372 expectations.

Manual checks:

- Mint reverts for non-owner.
- Mint reverts above max supply.
- Delegation creates voting checkpoints.
- Transfers update delegated voting power.
- Permit nonces are exposed through the OpenZeppelin override.

### `ProtocolGovernor`

The Governor composes OpenZeppelin modules rather than custom vote math. Parameters match the rubric: 1 day delay, 1 week voting period, 4% quorum, and 1% proposal threshold. The Governor integrates with TimelockController, so successful proposals must be queued and delayed before execution.

Manual checks:

- `state` resolves through Timelock extension.
- Queue and execute functions use Timelock operations.
- Proposal threshold is non-zero.
- Quorum fraction is 4%.

### `ProtocolTreasury`

The treasury is the main upgradeable contract. It is initialized once through the proxy and disables implementation initializers in the constructor. Native ETH release uses `call{value:}` and checks the return value. Token movement uses SafeERC20. UUPS authorization is restricted to `UPGRADER_ROLE`.

Manual checks:

- Zero admin initialization reverts.
- Double initialization reverts.
- Unauthorized release and pause calls revert.
- V1 to V2 upgrade succeeds only for authorized upgrader.
- Reentrancy case-study confirms fixed pattern.

### `DefiSwapPair`

The AMM stores sorted token addresses, reserves, fee recipient, and LP token balances. It checks zero inputs, invalid tokens, zero recipients, low slippage outputs, and reserve overflow. Swaps and liquidity operations are `nonReentrant`.

Manual checks:

- Initial liquidity mints LP shares and locks minimum liquidity.
- Duplicate/invalid pair conditions revert at factory level.
- Swap output follows fee-adjusted constant-product formula.
- Product invariant does not decrease in tested swap paths.

### `YieldVault`

The vault inherits OpenZeppelin ERC4626 rather than reimplementing share math. Owner can pause/unpause and report yield. Deposits, mints, withdrawals, and redeems are guarded with both pause checks and reentrancy protection.

Manual checks:

- Deposit/mint/withdraw/redeem flows work.
- Pause blocks deposits.
- Unauthorized yield reporting reverts.
- Fuzz tests exercise deposit and withdrawal ranges.

### `ChainlinkPriceOracle`

The oracle adapter maps assets to feeds and staleness windows. Reads validate feed existence, positive price, complete round, non-zero timestamps, and freshness. Admin feed changes are owner-gated and Timelock-owned after deployment.

Manual checks:

- Unset feed reverts.
- Stale feed reverts.
- Invalid price reverts.
- Decimal scaling up and down to 18 decimals works.

## 15. Testing Evidence

The Foundry suite is organized by requirement category:

| Category | Evidence |
| --- | --- |
| Unit tests | `test001` through `test088` cover contract metadata, access control, main flows, and reverts |
| Fuzz tests | `testFuzz001` through `testFuzz010` cover AMM, vault, governance voting, treasury, oracle, items, and CREATE2 |
| Invariant tests | `invariant001` through `invariant005` cover AMM, LP supply, treasury accounting, vault accounting, and role assumptions |
| Vulnerability case studies | `testCaseStudy001` through `testCaseStudy004` reproduce and fix reentrancy/access-control bugs |
| Fork tests | `testFork001` through `testFork003` read mainnet USDC, Chainlink ETH/USD, and Uniswap V2 router when `MAINNET_RPC_URL` is provided |

Hardhat tests additionally cover deploy-oriented flows and the complete propose/vote/queue/execute lifecycle. This matters because the Hardhat deployment stack is what produced the Base Sepolia deployment.

## 16. Submission Checklist

| Requirement | Security status |
| --- | --- |
| No `tx.origin` authorization | Satisfied |
| No ETH `transfer`/`send` | Satisfied |
| External calls handle return values | Satisfied for native ETH release |
| ERC20 interactions use SafeERC20 | Satisfied in production token-moving contracts |
| Privileged functions guarded | Satisfied with Ownable/AccessControl/Timelock |
| Reentrancy protection where applicable | Satisfied |
| Stale oracle checks | Satisfied |
| Slither High/Medium gate | Configured in CI |
| Vulnerability case studies | Satisfied |

## 17. Final Audit Opinion

The protocol is defensible for the final project rubric. The strongest parts are the use of audited OpenZeppelin modules, clear Timelock ownership, explicit deployment verification, and extensive tests around revert paths and invariants. The weakest parts are operational rather than code-level: demo token centralization, mock oracle feeds, and the need for a hosted subgraph endpoint controlled by the team. These weaknesses are documented and acceptable for a testnet capstone, but they should be directly acknowledged during the defense.

## 18. Threat Model

### External user

An external user can call all public/external functions. The expected security boundary is that user-level actions cannot access privileged behavior, steal funds from the treasury, bypass vault accounting, mint arbitrary governance tokens, change oracle feeds, deploy pairs without authorization, or execute governance operations without passing Governor and Timelock.

Controls:

- privileged functions are guarded by Ownable or AccessControl;
- token-moving functions validate inputs;
- AMM and treasury token flows use SafeERC20;
- ETH transfer uses checked low-level call;
- functions with meaningful external calls use ReentrancyGuard.

### Malicious token holder

A token holder can delegate, propose if above threshold, vote, and execute successful proposals after the Timelock delay. This is intended. The security question is whether they can bypass delay or vote without voting power.

Controls:

- ERC20Votes checkpoints determine voting power;
- proposal threshold prevents no-power spam;
- quorum prevents tiny minority execution;
- Timelock delay prevents instant execution.

Residual risk: a majority token holder can still govern the protocol. This is a governance design property rather than a Solidity bug.

### Malicious deployer

The deployer is powerful during deployment. After deployment, the deployer should not retain Timelock admin or direct ownership of governed contracts.

Controls:

- deployment script transfers ownership/roles to Timelock;
- deployment script revokes deployer Timelock admin;
- post-deployment verification script checks final state.

Residual risk: if a future redeployment skips verification, admin backdoors could remain. The team should always include verification output with submissions.

### Malicious frontend

A malicious frontend can display misleading text or prepare transactions that users did not intend. It cannot bypass contract-level checks.

Controls:

- contract addresses are documented outside the frontend;
- BaseScan verification allows independent inspection;
- wallet confirmation shows target addresses and calldata;
- important state can be read from contracts directly.

Residual risk: users may sign malicious transactions if they trust the UI blindly. Production teams should add transaction simulation and clear signing labels.

### Malicious subgraph

A malicious or broken subgraph can return stale or incorrect indexed data. It cannot change on-chain state.

Controls:

- write actions go directly to contracts;
- frontend can still read core balances/reserves/proposal states from contracts;
- subgraph is used for activity/history views.

Residual risk: activity pages may be incomplete until indexing catches up.

## 19. Incident Response Plan

| Incident | First action | Governance action |
| --- | --- | --- |
| AMM issue | Pause dependent UI actions and warn users | Queue parameter/ownership changes through Timelock |
| Vault accounting issue | Pause vault deposits/withdrawals if needed | Timelock upgrade or parameter fix |
| Oracle feed issue | Stop relying on affected displayed price | Timelock updates feed or stale window |
| Treasury compromise attempt | Inspect queued Timelock operations | Cancel malicious proposal if possible |
| Frontend compromise | Publish warning and verify addresses from docs | No contract action unless on-chain proposal created |
| Subgraph outage | Use direct contract reads | Redeploy or reconfigure hosted subgraph |

The deployed system includes pause controls in treasury, vault, and ERC1155 items. The AMM itself is not globally pausable, so incident response for the AMM relies on frontend warnings, fee recipient changes, ownership controls, and future upgrade/deployment decisions. This is acceptable for the demo but should be revisited for production.

## 20. Upgrade Safety Review

The UUPS upgrade path is intentionally narrow:

1. The proxy delegates calls to `ProtocolTreasury`.
2. `_authorizeUpgrade` checks `UPGRADER_ROLE`.
3. `UPGRADER_ROLE` is granted to Timelock during initialization.
4. Timelock is controlled by Governor after deployment.
5. `ProtocolTreasuryV2` adds behavior but no storage.

Storage collision risk is low for the demonstrated V1 to V2 path because V2 does not add new variables. If a future V3 adds storage, the team must append variables after existing storage and preserve the storage gap convention. The team should run storage layout comparison tooling before any real upgrade.

## 21. Economic Assumptions

The AMM is a simple constant-product pool. It does not include concentrated liquidity, TWAP oracle output, protocol-owned liquidity, or advanced MEV protections. Users are responsible for choosing reasonable `minAmountOut`. The frontend should never set a dangerously low `minAmountOut` silently.

The ERC4626 vault is a simple tokenized vault for deposited assets and reported yield. It does not invest into external protocols. This reduces integration risk and keeps accounting auditable for the course. Inflation-attack style behavior should be discussed in defense: using OpenZeppelin ERC4626 provides standard rounding behavior, but production vaults often add additional mitigations for first-depositor edge cases.

The governance system assumes voting power has social legitimacy. In the demo, tokens are centralized for ease of operation. This is not production decentralization. It is acceptable only because the project is deployed to a testnet and the risk is explicitly documented.

## 22. Slither Low/Informational Justifications

If Slither reports low or informational issues, the team should classify them as follows:

| Category | Expected handling |
| --- | --- |
| Naming convention for `CLOCK_MODE` | Acknowledge as ERC6372-required naming |
| Timestamp usage | Acknowledge as voting clock or oracle freshness, not randomness |
| Assembly usage | Acknowledge as isolated benchmark utility |
| Mock contract privileges | Acknowledge as test/demo-only |
| External calls | Confirm SafeERC20 or checked native call |
| Upgradeability warnings | Confirm initializer and Timelock-controlled UUPS authorization |

High and Medium findings must be fixed or the project should not be submitted.
