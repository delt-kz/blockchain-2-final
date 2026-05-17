import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { shortAddress } from "../utils/format";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="wallet-connect">
      <span>{isConnected ? shortAddress(address) : "Wallet disconnected"}</span>
      {isConnected ? (
        <button type="button" onClick={() => disconnect()}>
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={() => connect({ connector: injected() })}
          disabled={isPending}
        >
          {isPending ? "Connecting..." : "Connect MetaMask"}
        </button>
      )}
    </div>
  );
}
