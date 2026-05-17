import { useState } from "react";
import { isAddress } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { governanceTokenAbi } from "../abi/governanceToken";
import { ErrorBox } from "../components/ErrorBox";
import { ProposalCard } from "../components/ProposalCard";
import { TxButton } from "../components/TxButton";
import { contracts } from "../config/contracts";
import { useConnectedChain } from "../hooks/useConnectedChain";
import { useGovernance } from "../hooks/useGovernance";
import { getReadableError } from "../utils/errors";

export function Governance() {
  const { address, isConnected } = useAccount();
  const { isBaseSepolia } = useConnectedChain();
  const { proposals } = useGovernance();
  const { writeContract, isPending } = useWriteContract();
  const [delegatee, setDelegatee] = useState("");
  const [error, setError] = useState("");

  function delegateVotes() {
    setError("");
    if (!isBaseSepolia) {
      setError("Wrong network. Please switch to Base Sepolia.");
      return;
    }
    const target = delegatee || address;
    if (!target || !isAddress(target)) {
      setError(
        "Enter a valid delegate address or connect your wallet to self-delegate."
      );
      return;
    }
    writeContract(
      {
        address: contracts.governanceToken,
        abi: governanceTokenAbi,
        functionName: "delegate",
        args: [target],
      },
      { onError: (nextError) => setError(getReadableError(nextError)) }
    );
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Governance</span>
        <h2>Delegate and vote</h2>
      </div>
      <section className="panel form-panel">
        <h3>Delegate voting power</h3>
        <div className="input-row">
          <input
            value={delegatee}
            onChange={(event) => setDelegatee(event.target.value)}
            placeholder={
              address ? "Leave blank to self-delegate" : "Delegate address"
            }
          />
          <TxButton
            onClick={delegateVotes}
            disabled={!isConnected || !isBaseSepolia}
            pending={isPending}
          >
            Delegate
          </TxButton>
        </div>
        <ErrorBox message={error} />
      </section>
      <section className="panel">
        <h3>Proposals</h3>
        {proposals.length === 0 ? (
          <p className="muted">
            No proposal IDs are configured yet. Add known proposal IDs in
            <code> frontend/src/config/proposals.ts</code> after creating
            proposals.
          </p>
        ) : (
          <div className="proposal-list">
            {proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id.toString()}
                {...proposal}
                disabled={!isBaseSepolia}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
