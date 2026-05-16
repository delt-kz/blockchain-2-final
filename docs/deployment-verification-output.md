# Deployment Verification Output

Command:

```bash
npm run verify:deployment:base-sepolia
```

Expected output for the committed Base Sepolia deployment:

```text
ok - deployer no longer has timelock admin
ok - timelock self-admin remains
ok - timelock delay is 2 days
ok - governor voting delay is 1 day
ok - governor voting period is 1 week
ok - governor quorum is 4%
ok - proposal threshold is 1%
ok - governance token owner is timelock
ok - vault owner is timelock
ok - oracle owner is timelock
ok - factory owner is timelock
ok - pair owner is timelock
ok - treasury admin is timelock
ok - treasury treasurer is timelock
ok - treasury upgrader is timelock
Deployment verification passed for baseSepolia
```

The deployed addresses and BaseScan links are listed in `docs/base-sepolia-deployment.md`.
