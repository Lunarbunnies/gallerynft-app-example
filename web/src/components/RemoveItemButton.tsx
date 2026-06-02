"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserProvider, Contract } from "ethers";
import {
  GALLERY_NFT_ABI,
  GALLERY_NFT_ADDRESS,
  GALLERY_NFT_CHAIN_ID,
  isWalletModeEnabled,
} from "../lib/galleryContract";

export function RemoveItemButton({
  galleryId,
  itemKey,
}: {
  galleryId: number;
  itemKey: string;
}) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const walletMode = isWalletModeEnabled();

  async function removeOnChainItem() {
    if (!window.ethereum) {
      throw new Error("No EVM wallet found. Install MetaMask or another injected wallet.");
    }

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== GALLERY_NFT_CHAIN_ID) {
      throw new Error(`Wrong network. Switch wallet to chain ${GALLERY_NFT_CHAIN_ID}.`);
    }

    const signer = await provider.getSigner();
    const contract = new Contract(GALLERY_NFT_ADDRESS, GALLERY_NFT_ABI, signer);
    const tx = await contract.removeItem(BigInt(galleryId), itemKey);
    await tx.wait();
  }

  async function handleRemove() {
    setIsRemoving(true);
    setError(null);
    try {
      if (walletMode) {
        await removeOnChainItem();
      }

      const response = await fetch(
        `/api/galleries/${galleryId}/items/${itemKey}/remove`,
        { method: "POST" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to remove item");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <button
        type="button"
        onClick={handleRemove}
        disabled={isRemoving}
        style={{
          width: "fit-content",
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid #a00020",
          background: isRemoving ? "var(--panel-2)" : "var(--panel)",
          color: "#a00020",
        }}
      >
        {isRemoving ? "Removing..." : walletMode ? "Remove on-chain" : "Remove item"}
      </button>
      {error ? <div style={{ color: "#b00020" }}>{error}</div> : null}
    </div>
  );
}
