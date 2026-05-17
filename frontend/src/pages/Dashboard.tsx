import { useAccount } from "wagmi";
import { StatCard } from "../components/StatCard";
import { useConnectedChain } from "../hooks/useConnectedChain";
import { useProtocolState } from "../hooks/useProtocolState";
import { useTokenData } from "../hooks/useTokenData";
import { formatToken, shortAddress } from "../utils/format";

export function Dashboard() {
  const { address } = useAccount();
  const { chainName, chainId } = useConnectedChain();
  const token = useTokenData();
  const protocol = useProtocolState();

  return (
    <div className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Dashboard</span>
        <h2>Base Sepolia protocol state</h2>
      </div>
      <div className="stats-grid">
        <StatCard label="Wallet" value={shortAddress(address)} />
        <StatCard
          label="Network"
          value={`${chainName}${chainId ? ` (${chainId})` : ""}`}
        />
        <StatCard
          label="Governance balance"
          value={`${formatToken(token.balance)} ${token.symbol}`}
        />
        <StatCard
          label="Voting power"
          value={`${formatToken(token.votingPower)} ${token.symbol}`}
        />
        <StatCard label="Delegate" value={shortAddress(token.delegate)} />
        <StatCard
          label="Vault total assets"
          value={`${formatToken(protocol.totalAssets)} USDC`}
        />
        <StatCard
          label="Vault total supply"
          value={`${formatToken(protocol.totalSupply)} dsvSHARE`}
        />
        <StatCard
          label="Your vault shares"
          value={`${formatToken(protocol.userShares)} dsvSHARE`}
        />
      </div>
      <section className="panel">
        <h3>AMM Pair</h3>
        <div className="kv-grid">
          <span>Token 0</span>
          <strong>{shortAddress(protocol.token0)}</strong>
          <span>Token 1</span>
          <strong>{shortAddress(protocol.token1)}</strong>
          <span>Reserve 0</span>
          <strong>{formatToken(protocol.reserves?.[0])}</strong>
          <span>Reserve 1</span>
          <strong>{formatToken(protocol.reserves?.[1])}</strong>
        </div>
      </section>
    </div>
  );
}
