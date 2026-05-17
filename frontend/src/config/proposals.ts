export type ConfiguredProposal = {
  id: bigint;
  title: string;
  description?: string;
};

// ProtocolGovernor does not expose on-chain proposal enumeration.
// Add known proposal IDs here after creating proposals, for example:
// { id: 12345678901234567890n, title: "Fund the protocol treasury" }
export const proposals: ConfiguredProposal[] = [];
