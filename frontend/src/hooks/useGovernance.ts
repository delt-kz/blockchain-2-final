import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { governorAbi } from "../abi/governor";
import { contracts } from "../config/contracts";
import { proposals } from "../config/proposals";
import { useConnectedChain } from "./useConnectedChain";

export function useGovernance() {
  const { isBaseSepolia } = useConnectedChain();
  const proposalReads = useMemo(
    () =>
      proposals.map((proposal) => ({
        address: contracts.governor,
        abi: governorAbi,
        functionName: "state",
        args: [proposal.id],
      })),
    [],
  );

  const states = useReadContracts({
    allowFailure: true,
    contracts: proposalReads as any,
    query: { enabled: proposals.length > 0 && isBaseSepolia },
  });

  return {
    proposals: proposals.map((proposal, index) => ({
      ...proposal,
      state: states.data?.[index]?.result as number | undefined,
    })),
    isLoading: states.isLoading,
    refetch: states.refetch,
  };
}
