import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { erc20Abi } from "../abi/erc20";
import { vaultAbi } from "../abi/vault";
import { ErrorBox } from "../components/ErrorBox";
import { StatCard } from "../components/StatCard";
import { TxButton } from "../components/TxButton";
import { contracts } from "../config/contracts";
import { useConnectedChain } from "../hooks/useConnectedChain";
import { useProtocolState } from "../hooks/useProtocolState";
import { getReadableError } from "../utils/errors";
import { formatToken } from "../utils/format";

export function ProtocolActions() {
  const { address, isConnected } = useAccount();
  const { isBaseSepolia } = useConnectedChain();
  const protocol = useProtocolState();
  const { writeContract, isPending } = useWriteContract();
  const [amount, setAmount] = useState("1");
  const [error, setError] = useState("");

  const amountWei = safeParseAmount(amount);
  const needsApproval =
    amountWei > 0n && (protocol.usdcAllowance ?? 0n) < amountWei;

  function approveUsdc() {
    setError("");
    if (!isBaseSepolia) {
      setError("Wrong network. Please switch to Base Sepolia.");
      return;
    }
    if (amountWei <= 0n) {
      setError("Enter a deposit amount greater than zero.");
      return;
    }
    writeContract(
      {
        address: contracts.usdc,
        abi: erc20Abi,
        functionName: "approve",
        args: [contracts.vault, amountWei],
      },
      { onError: (nextError) => setError(getReadableError(nextError)) },
    );
  }

  function deposit() {
    setError("");
    if (!isBaseSepolia) {
      setError("Wrong network. Please switch to Base Sepolia.");
      return;
    }
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    if (amountWei <= 0n) {
      setError("Enter a deposit amount greater than zero.");
      return;
    }
    writeContract(
      {
        address: contracts.vault,
        abi: vaultAbi,
        functionName: "deposit",
        args: [amountWei, address],
      },
      { onError: (nextError) => setError(getReadableError(nextError)) },
    );
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Protocol Actions</span>
        <h2>ERC4626 vault deposit</h2>
      </div>
      <div className="stats-grid">
        <StatCard
          label="Your USDC"
          value={`${formatToken(protocol.usdcBalance)} USDC`}
        />
        <StatCard
          label="Vault allowance"
          value={`${formatToken(protocol.usdcAllowance)} USDC`}
        />
        <StatCard
          label="Your vault shares"
          value={`${formatToken(protocol.userShares)} dsvSHARE`}
        />
      </div>
      <section className="panel form-panel">
        <h3>Deposit USDC</h3>
        <div className="input-row">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
          />
          {needsApproval ? (
            <TxButton
              onClick={approveUsdc}
              disabled={!isConnected || !isBaseSepolia}
              pending={isPending}
            >
              Approve USDC
            </TxButton>
          ) : (
            <TxButton
              onClick={deposit}
              disabled={!isConnected || !isBaseSepolia}
              pending={isPending}
            >
              Deposit
            </TxButton>
          )}
        </div>
        <p className="muted">
          This action uses the deployed USDC mock and YieldVault on Base
          Sepolia.
        </p>
        <ErrorBox message={error} />
      </section>
    </div>
  );
}

function safeParseAmount(value: string) {
  try {
    return parseUnits(value || "0", 18);
  } catch {
    return 0n;
  }
}
