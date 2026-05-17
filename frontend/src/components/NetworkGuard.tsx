import { useState } from "react";
import { useAccount } from "wagmi";
import { useConnectedChain, switchToBaseSepolia } from "../hooks/useConnectedChain";
import { getReadableError } from "../utils/errors";

export function NetworkGuard() {
  const { isConnected } = useAccount();
  const { chainId, isWrongNetwork } = useConnectedChain();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  async function handleSwitchNetwork() {
    setError("");
    setIsPending(true);
    try {
      await switchToBaseSepolia();
    } catch (nextError) {
      setError(getReadableError(nextError));
    } finally {
      setIsPending(false);
    }
  }

  if (!isConnected || !isWrongNetwork) return null;

  return (
    <div className="network-guard">
      <div>
        <strong>Wrong network. Please switch to Base Sepolia.</strong>
        <span>Current chain ID: {chainId ?? "unknown"}.</span>
        {error ? <span>{error}</span> : null}
      </div>
      <button type="button" onClick={handleSwitchNetwork} disabled={isPending}>
        {isPending ? "Switching..." : "Switch to Base Sepolia"}
      </button>
    </div>
  );
}
