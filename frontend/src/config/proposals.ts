export type ConfiguredProposal = {
  id: bigint;
  title: string;
  description?: string;
};

// ProtocolGovernor does not expose on-chain proposal enumeration.
export const proposals: ConfiguredProposal[] = [
  {
    id: 802469611665103410208070363780169661838614947002224719026573905077607966510n,
    title: "Mint one demo ERC1155 item",
    description:
      "Base Sepolia proposal created for the final project UI vote demo.",
  },
];
