# Base Sepolia Deployment

Network: Base Sepolia  
Chain ID: 84532  
Deployment file: `deployments/baseSepolia.json`

| Contract | Address | BaseScan |
| --- | --- | --- |
| GovernanceToken | `0x11Cb8e82cc243Abbb960373E701a10593234A8dA` | https://sepolia.basescan.org/address/0x11Cb8e82cc243Abbb960373E701a10593234A8dA#code |
| TimelockController | `0x433A20a53036798EEf6E9f99f76fe4D8a334d999` | https://sepolia.basescan.org/address/0x433A20a53036798EEf6E9f99f76fe4D8a334d999#code |
| ProtocolGovernor | `0x131B28c5141eff6860312643C44BFEE911AF4A7C` | https://sepolia.basescan.org/address/0x131B28c5141eff6860312643C44BFEE911AF4A7C#code |
| ProtocolTreasury implementation | `0xbe2A936b4eE2D9834F45F32bEfe1f5105955F920` | https://sepolia.basescan.org/address/0xbe2A936b4eE2D9834F45F32bEfe1f5105955F920#code |
| ProtocolTreasury proxy | `0x517E233f82aCA99855da1868e59c62c053DE1B2B` | https://sepolia.basescan.org/address/0x517E233f82aCA99855da1868e59c62c053DE1B2B#code |
| Mock sUSD | `0xc57a698eAbb1eE7Fe87C741ea2EC4e860038C069` | https://sepolia.basescan.org/address/0xc57a698eAbb1eE7Fe87C741ea2EC4e860038C069#code |
| Mock sWETH | `0x79E1fBC061bE3B20e8a76bf3bc84FD19F4039E56` | https://sepolia.basescan.org/address/0x79E1fBC061bE3B20e8a76bf3bc84FD19F4039E56#code |
| YieldVault | `0xDBCFA9EC3607e94298070202bF29aCeC5799b6af` | https://sepolia.basescan.org/address/0xDBCFA9EC3607e94298070202bF29aCeC5799b6af#code |
| ProtocolItems | `0xEDB4203e218795531AC31D1A2bdEc83f8A38A41A` | https://sepolia.basescan.org/address/0xEDB4203e218795531AC31D1A2bdEc83f8A38A41A#code |
| ChainlinkPriceOracle | `0xd9D6Caa996b8691Ca810545f9Ca04F1fF0Fdf8c4` | https://sepolia.basescan.org/address/0xd9D6Caa996b8691Ca810545f9Ca04F1fF0Fdf8c4#code |
| Mock ETH/USD feed | `0x53f721B8505E8B663b15cA9cF542460BBC9826d2` | https://sepolia.basescan.org/address/0x53f721B8505E8B663b15cA9cF542460BBC9826d2#code |
| Mock USDC/USD feed | `0x069a81F5c06aC61bC8bAD9D8bb0c4350852aB3b4` | https://sepolia.basescan.org/address/0x069a81F5c06aC61bC8bAD9D8bb0c4350852aB3b4#code |
| PairFactory | `0x829aF2859fA5D72b26C54f6467f625a86Ef89B67` | https://sepolia.basescan.org/address/0x829aF2859fA5D72b26C54f6467f625a86Ef89B67#code |
| DefiSwapPair | `0x45B59F4866A5748721c82db2Cc5149CFc5178dDB` | https://sepolia.basescan.org/address/0x45B59F4866A5748721c82db2Cc5149CFc5178dDB#code |

Post-deployment check passed:

- Timelock delay is 2 days.
- Governor voting delay is 1 day.
- Governor voting period is 1 week.
- Governor quorum is 4%.
- Proposal threshold is 1%.
- Token, vault, oracle, factory, pair, and treasury privileges are controlled by Timelock.
