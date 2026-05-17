export const proposalStateText: Record<number, string> = {
  0: "Pending",
  1: "Active",
  2: "Canceled",
  3: "Defeated",
  4: "Succeeded",
  5: "Queued",
  6: "Expired",
  7: "Executed",
};

export function getProposalStateText(state?: number) {
  if (state === undefined) return "Unknown";
  return proposalStateText[state] ?? `Unknown (${state})`;
}
