import { useAccount, useReadContracts } from "wagmi";
import { governanceTokenAbi } from "../abi/governanceToken";
import { contracts } from "../config/contracts";
import { useConnectedChain } from "./useConnectedChain";

export function useTokenData() {
  const { address } = useAccount();
  const { isBaseSepolia } = useConnectedChain();
  const result = useReadContracts({
    allowFailure: true,
    query: { enabled: Boolean(address) && isBaseSepolia },
    contracts: address
      ? [
          { address: contracts.governanceToken, abi: governanceTokenAbi, functionName: "balanceOf", args: [address] },
          { address: contracts.governanceToken, abi: governanceTokenAbi, functionName: "getVotes", args: [address] },
          { address: contracts.governanceToken, abi: governanceTokenAbi, functionName: "delegates", args: [address] },
          { address: contracts.governanceToken, abi: governanceTokenAbi, functionName: "symbol" },
        ]
      : [],
  });

  const [balance, votes, delegate, symbol] = result.data ?? [];
  return {
    ...result,
    balance: balance?.result as bigint | undefined,
    votingPower: votes?.result as bigint | undefined,
    delegate: delegate?.result as `0x${string}` | undefined,
    symbol: (symbol?.result as string | undefined) ?? "DSG",
  };
}
