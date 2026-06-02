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

declare global {
  interface Window {
    ethereum?: any;
  }
}

export function CreateGalleryForm() {
  const router = useRouter();
  const [owner, setOwner] = useState("");
  const [connectedWallet, setConnectedWallet] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const walletMode = isWalletModeEnabled();

  async function connectWallet() {
    setError(null);
    if (!window.ethereum) {
      setError("No EVM wallet found. Install MetaMask or another injected wallet.");
      return "";
    }

    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== GALLERY_NFT_CHAIN_ID) {
      setError(`Wrong network. Switch wallet to chain ${GALLERY_NFT_CHAIN_ID}.`);
      return "";
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setConnectedWallet(address);
    setOwner(address);
    return address;
  }

  async function createOnChainGallery() {
    const address = connectedWallet || (await connectWallet());
    if (!address) return null;

    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const contract = new Contract(GALLERY_NFT_ADDRESS, GALLERY_NFT_ABI, signer);
    const tx = await contract.createGallery(title.trim(), description.trim());
    const receipt = await tx.wait();

    const parsed = receipt.logs
      .map((log: any) => {
        try {
          return contract.interface.parseLog(log);
        } catch (_err) {
          return null;
        }
      })
      .find((log: any) => log?.name === "GalleryCreated");

    if (!parsed) {
      throw new Error("GalleryCreated event not found in transaction receipt");
    }

    return {
      galleryId: Number(parsed.args.galleryId),
      owner: address,
    };
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const onChain = walletMode ? await createOnChainGallery() : null;
      if (walletMode && !onChain) {
        return;
      }

      const response = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: onChain?.owner || owner,
          title,
          description,
          galleryId: onChain?.galleryId,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to create gallery");
      }

      const payload = await response.json();
      router.push(`/g/${onChain?.galleryId || payload.galleryId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px", maxWidth: "420px" }}>
      {walletMode ? (
        <div style={{ display: "grid", gap: "8px" }}>
          <button
            type="button"
            onClick={connectWallet}
            style={{
              padding: "8px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--panel)",
              color: "var(--text)",
            }}
          >
            {connectedWallet
              ? `${connectedWallet.slice(0, 6)}...${connectedWallet.slice(-4)}`
              : "Connect wallet"}
          </button>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Contract: {GALLERY_NFT_ADDRESS.slice(0, 6)}...{GALLERY_NFT_ADDRESS.slice(-4)}
          </div>
        </div>
      ) : (
        <label style={{ display: "grid", gap: "6px" }}>
          <span>Owner wallet address (EVM or Tezos)</span>
          <input
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            placeholder="0x... or tz1/KT1"
            style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
            required
          />
        </label>
      )}
      <label style={{ display: "grid", gap: "6px" }}>
        <span>Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Gallery title"
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          required
        />
      </label>
      <label style={{ display: "grid", gap: "6px" }}>
        <span>Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Longer description"
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          rows={4}
          required
        />
      </label>
      {error ? <div style={{ color: "#b00020" }}>{error}</div> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          padding: "10px 14px",
          borderRadius: "6px",
          border: "1px solid #222",
          background: isSubmitting ? "#eee" : "#111",
          color: isSubmitting ? "#666" : "#fff",
        }}
      >
        {isSubmitting ? "Creating..." : "Create gallery"}
      </button>
    </form>
  );
}
