import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { governorAbi } from "../abi/governor";
import { contracts } from "../config/contracts";
import type { ConfiguredProposal } from "../config/proposals";
import { getReadableError } from "../utils/errors";
import { formatProposalId } from "../utils/format";
import { getProposalStateText } from "../utils/proposalState";
import { ErrorBox } from "./ErrorBox";
import { TxButton } from "./TxButton";

type Props = ConfiguredProposal & {
  state?: number;
  disabled?: boolean;
};

const voteOptions = [
  ["Against", 0],
  ["For", 1],
  ["Abstain", 2],
] as const;

export function ProposalCard({
  id,
  title,
  description,
  state,
  disabled,
}: Props) {
  const { isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const [error, setError] = useState("");

  function castVote(support: 0 | 1 | 2) {
    setError("");
    if (disabled) {
      setError("Wrong network. Please switch to Base Sepolia.");
      return;
    }
    writeContract(
      {
        address: contracts.governor,
        abi: governorAbi,
        functionName: "castVote",
        args: [id, support],
      },
      {
        onError: (nextError) => setError(getReadableError(nextError)),
      }
    );
  }

  return (
    <article className="proposal-card">
      <div>
        <span className="eyebrow">Proposal {formatProposalId(id)}</span>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      <strong className="state-pill">{getProposalStateText(state)}</strong>
      <div className="button-row">
        {voteOptions.map(([label, support]) => (
          <TxButton
            key={label}
            onClick={() => castVote(support)}
            disabled={!isConnected || disabled}
            pending={isPending}
          >
            Vote {label}
          </TxButton>
        ))}
      </div>
      <ErrorBox message={error} />
    </article>
  );
}
