import { useEffect, useMemo, useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { baseSepolia, expectedChainId } from "../config/chains";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: "chainChanged", listener: (chainId: string) => void) => void;
  removeListener?: (
    event: "chainChanged",
    listener: (chainId: string) => void,
  ) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const knownChainNames: Record<number, string> = {
  1: "Ethereum Mainnet",
  10: "OP Mainnet",
  8453: "Base",
  84532: "Base Sepolia",
  11155111: "Sepolia",
  31337: "Hardhat",
  42161: "Arbitrum One",
  421614: "Arbitrum Sepolia",
};

export function useConnectedChain() {
  const { chainId: accountChainId, isConnected } = useAccount();
  const wagmiChainId = useChainId();
  const [walletChainId, setWalletChainId] = useState<number | undefined>(
    undefined,
  );

  useEffect(() => {
    if (!isConnected || !window.ethereum) {
      setWalletChainId(undefined);
      return;
    }

    let active = true;
    const updateChain = (hexChainId: string) => {
      const parsed = Number.parseInt(hexChainId, 16);
      if (Number.isFinite(parsed)) setWalletChainId(parsed);
    };

    window.ethereum
      .request({ method: "eth_chainId" })
      .then((chainId) => {
        if (active && typeof chainId === "string") updateChain(chainId);
      })
      .catch(() => {
        if (active) setWalletChainId(accountChainId ?? wagmiChainId);
      });

    window.ethereum.on?.("chainChanged", updateChain);
    return () => {
      active = false;
      window.ethereum?.removeListener?.("chainChanged", updateChain);
    };
  }, [accountChainId, isConnected, wagmiChainId]);

  const chainId = walletChainId ?? accountChainId ?? wagmiChainId;
  const isBaseSepolia = isConnected && chainId === expectedChainId;

  return useMemo(
    () => ({
      chainId,
      chainName: chainId
        ? (knownChainNames[chainId] ?? `Chain ${chainId}`)
        : "Not connected",
      isBaseSepolia,
      isWrongNetwork: isConnected && chainId !== expectedChainId,
    }),
    [chainId, isBaseSepolia, isConnected],
  );
}

export async function switchToBaseSepolia() {
  if (!window.ethereum) throw new Error("Connect MetaMask first.");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x14a34" }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: number }).code
        : undefined;
    if (code !== 4902) throw error;

    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0x14a34",
          chainName: baseSepolia.name,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://sepolia.base.org"],
          blockExplorerUrls: ["https://sepolia.basescan.org"],
        },
      ],
    });
  }
}
