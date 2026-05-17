import { ErrorBox } from "../components/ErrorBox";
import { subgraphUrl } from "../config/subgraph";
import { useSubgraphData } from "../hooks/useSubgraphData";
import { getReadableError } from "../utils/errors";

export function SubgraphData() {
  const { data, error, isLoading } = useSubgraphData();

  if (!subgraphUrl) {
    return (
      <div className="page-stack">
        <div className="section-heading">
          <span className="eyebrow">Subgraph</span>
          <h2>Indexed protocol activity</h2>
        </div>
        <ErrorBox message="Subgraph URL is not configured yet." />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="section-heading">
        <span className="eyebrow">Subgraph</span>
        <h2>Indexed protocol activity</h2>
      </div>
      {isLoading ? <p className="muted">Loading subgraph data...</p> : null}
      <ErrorBox message={error ? getReadableError(error) : ""} />
      {data ? (
        <div className="subgraph-grid">
          <JsonPanel title="Token transfers" rows={data.tokenTransfers} />
          <JsonPanel title="Votes" rows={data.voteCasts} />
          <JsonPanel title="Swaps" rows={data.swaps} />
          <JsonPanel title="Vault deposits" rows={data.vaultDeposits} />
        </div>
      ) : null}
    </div>
  );
}

function JsonPanel({ title, rows }: { title: string; rows: unknown[] }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">No indexed rows yet.</p>
      ) : (
        <pre>{JSON.stringify(rows, null, 2)}</pre>
      )}
    </section>
  );
}
