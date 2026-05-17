import { useQuery } from "@tanstack/react-query";
import { subgraphUrl } from "../config/subgraph";

const query = `
  query FrontendSummary {
    tokenTransfers(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
      id
      from
      to
      value
      blockTimestamp
    }
    voteCasts(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
      id
      voter
      proposalId
      support
      weight
    }
    swaps(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
      id
      sender
      tokenIn
      amountIn
      amountOut
    }
    vaultDeposits(first: 5, orderBy: blockTimestamp, orderDirection: desc) {
      id
      caller
      owner
      assets
      shares
    }
  }
`;

export function useSubgraphData() {
  return useQuery({
    queryKey: ["subgraph-summary", subgraphUrl],
    enabled: Boolean(subgraphUrl),
    queryFn: async () => {
      if (!subgraphUrl) throw new Error("Subgraph URL is not configured yet.");
      const response = await fetch(subgraphUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const payload = await response.json();
      if (!response.ok || payload.errors) {
        throw new Error(
          payload.errors?.[0]?.message ?? "Subgraph request failed."
        );
      }
      return payload.data as {
        tokenTransfers: unknown[];
        voteCasts: unknown[];
        swaps: unknown[];
        vaultDeposits: unknown[];
      };
    },
  });
}
