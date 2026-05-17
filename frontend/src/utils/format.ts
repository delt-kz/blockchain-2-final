import { formatUnits, isAddress } from "viem";

export function shortAddress(address?: string) {
  if (!address || !isAddress(address)) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatToken(value?: bigint, decimals = 18, max = 4) {
  if (value === undefined) return "-";
  const formatted = formatUnits(value, decimals);
  const [whole, fraction = ""] = formatted.split(".");
  return fraction ? `${whole}.${fraction.slice(0, max)}` : whole;
}

export function formatProposalId(id: bigint) {
  const text = id.toString();
  return text.length > 18 ? `${text.slice(0, 10)}...${text.slice(-8)}` : text;
}
