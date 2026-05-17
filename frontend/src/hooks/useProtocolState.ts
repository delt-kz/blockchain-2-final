import { useAccount, useReadContracts } from "wagmi";
import { ammPairAbi } from "../abi/ammPair";
import { erc20Abi } from "../abi/erc20";
import { vaultAbi } from "../abi/vault";
import { contracts } from "../config/contracts";
import { useConnectedChain } from "./useConnectedChain";

export function useProtocolState() {
  const { address } = useAccount();
  const { isBaseSepolia } = useConnectedChain();
  const contractsToRead = [
    {
      address: contracts.ammPair,
      abi: ammPairAbi,
      functionName: "getReserves",
    },
    { address: contracts.ammPair, abi: ammPairAbi, functionName: "token0" },
    { address: contracts.ammPair, abi: ammPairAbi, functionName: "token1" },
    { address: contracts.vault, abi: vaultAbi, functionName: "totalAssets" },
    { address: contracts.vault, abi: vaultAbi, functionName: "totalSupply" },
    ...(address
      ? [
          {
            address: contracts.vault,
            abi: vaultAbi,
            functionName: "balanceOf",
            args: [address],
          },
          {
            address: contracts.usdc,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address],
          },
          {
            address: contracts.usdc,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, contracts.vault],
          },
        ]
      : []),
  ];

  const reads = useReadContracts({
    allowFailure: true,
    query: { enabled: isBaseSepolia },
    contracts: contractsToRead as any,
  });

  const [
    reserves,
    token0,
    token1,
    totalAssets,
    totalSupply,
    userShares,
    usdcBalance,
    usdcAllowance,
  ] = reads.data ?? [];
  return {
    ...reads,
    reserves: reserves?.result as readonly [bigint, bigint] | undefined,
    token0: token0?.result as `0x${string}` | undefined,
    token1: token1?.result as `0x${string}` | undefined,
    totalAssets: totalAssets?.result as bigint | undefined,
    totalSupply: totalSupply?.result as bigint | undefined,
    userShares: userShares?.result as bigint | undefined,
    usdcBalance: usdcBalance?.result as bigint | undefined,
    usdcAllowance: usdcAllowance?.result as bigint | undefined,
  };
}
