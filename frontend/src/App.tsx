import { useState } from "react";
import { NetworkGuard } from "./components/NetworkGuard";
import { WalletConnect } from "./components/WalletConnect";
import { Dashboard } from "./pages/Dashboard";
import { Governance } from "./pages/Governance";
import { ProtocolActions } from "./pages/ProtocolActions";
import { SubgraphData } from "./pages/SubgraphData";

const tabs = ["Dashboard", "Governance", "Protocol Actions", "Subgraph Data"] as const;
type Tab = (typeof tabs)[number];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Dashboard");

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">DeFi Student Protocol</span>
          <h1>Frontend, governance, and indexed data</h1>
        </div>
        <WalletConnect />
      </header>
      <NetworkGuard />
      <nav className="tabs" aria-label="Main navigation">
        {tabs.map((tab) => (
          <button key={tab} type="button" className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </nav>
      {activeTab === "Dashboard" ? <Dashboard /> : null}
      {activeTab === "Governance" ? <Governance /> : null}
      {activeTab === "Protocol Actions" ? <ProtocolActions /> : null}
      {activeTab === "Subgraph Data" ? <SubgraphData /> : null}
    </main>
  );
}
