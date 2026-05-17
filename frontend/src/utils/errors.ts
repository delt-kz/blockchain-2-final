export function getReadableError(error: unknown): string {
  if (!error) return "Something went wrong.";
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied")) {
    return "Transaction was rejected in the wallet.";
  }
  if (
    lower.includes("wrong network") ||
    lower.includes("chain mismatch") ||
    lower.includes("unsupported chain")
  ) {
    return "Wrong network. Please switch to Base Sepolia.";
  }
  if (
    lower.includes("insufficient funds") ||
    lower.includes("insufficient balance")
  ) {
    return "Insufficient balance for this transaction.";
  }
  if (lower.includes("execution reverted") || lower.includes("reverted")) {
    return "The contract rejected the transaction. Check balances, allowance, proposal state, or permissions.";
  }
  if (
    lower.includes("connector not connected") ||
    lower.includes("not connected")
  ) {
    return "Connect your wallet first.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror")) {
    return "RPC or subgraph request failed. Check your network connection and endpoint.";
  }
  if (lower.includes("subgraph url")) {
    return "Subgraph URL is not configured yet.";
  }

  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
}
