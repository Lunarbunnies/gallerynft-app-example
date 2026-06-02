"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BrowserProvider, Contract } from "ethers";
import { GalleryFieldsModal } from "./GalleryFieldsModal";
import { AddItemModal } from "./AddItemModal";
import { GalleryEditor } from "./GalleryEditor";
import type { ChainGallery, ChainItem } from "../lib/chain";
import {
  GALLERY_NFT_ABI,
  GALLERY_NFT_ADDRESS,
  GALLERY_NFT_CHAIN_ID,
  isWalletModeEnabled,
} from "../lib/galleryContract";

export function GalleryWorkspace({
  gallery,
  items,
}: {
  gallery: ChainGallery;
  items: ChainItem[];
}) {
  const [pendingGallery, setPendingGallery] = useState<{
    title: string;
    description: string;
  } | null>(null);
  const [pendingItems, setPendingItems] = useState<
    Record<
      string,
      {
        displayOrder: number | null;
        label: string;
        note: string;
      }
    >
  >({});
  const [showWalletMock, setShowWalletMock] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);
  const walletMode = isWalletModeEnabled();

  const pendingCount = useMemo(() => {
    const itemCount = Object.keys(pendingItems).length;
    const galleryCount = pendingGallery ? 1 : 0;
    return itemCount + galleryCount;
  }, [pendingItems, pendingGallery]);

  async function applyChanges() {
    setIsApplying(true);
    setError(null);
    setAppliedMessage(null);
    try {
      if (walletMode) {
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
        if (pendingGallery) {
          const tx = await contract.setGalleryFields(
            BigInt(gallery.galleryId),
            pendingGallery.title.trim(),
            pendingGallery.description.trim()
          );
          await tx.wait();
        }

        for (const [itemKey, fields] of Object.entries(pendingItems)) {
          const tx = await contract.updateItemFields(
            BigInt(gallery.galleryId),
            itemKey,
            fields.displayOrder ?? 0,
            fields.label.trim(),
            fields.note.trim()
          );
          await tx.wait();
        }
      }

      const response = await fetch(`/api/galleries/${gallery.galleryId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gallery: pendingGallery,
          items: pendingItems,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to apply changes");
      }
      setPendingGallery(null);
      setPendingItems({});
      setAppliedMessage(
        walletMode ? "Changes confirmed on-chain and cache updated." : "Changes applied. Syncing on-chain state..."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply changes");
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "center",
          justifyContent: "space-between",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "10px 12px",
          background: "var(--panel)",
        }}
      >
        <div style={{ display: "grid", gap: "4px" }}>
          <div style={{ fontWeight: 600 }}>Gallery #{gallery.galleryId}</div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Owner: {gallery.owner}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>
            Title: {(pendingGallery?.title || gallery.title) ?? "Untitled"}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <AddItemModal galleryId={gallery.galleryId} />
          <GalleryFieldsModal
            galleryId={gallery.galleryId}
            title={pendingGallery?.title ?? gallery.title}
            description={pendingGallery?.description ?? gallery.description}
            onStage={(payload) => setPendingGallery(payload)}
          />
          <Link
            href={`/g/${gallery.galleryId}/send`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--panel)",
              color: "var(--text)",
              textDecoration: "none",
              fontSize: "12px",
            }}
          >
            Send gallery
          </Link>
          <Link
            href={`/frame/${gallery.galleryId}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--panel)",
              color: "var(--text)",
              textDecoration: "none",
              fontSize: "12px",
            }}
          >
            Frame view
          </Link>
          <button
            type="button"
            onClick={() => setShowWalletMock(true)}
            disabled={pendingCount === 0 || isApplying}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: pendingCount === 0 ? "var(--panel-2)" : "var(--text)",
              color: pendingCount === 0 ? "var(--muted)" : "var(--bg)",
            }}
          >
            {isApplying ? "Applying..." : `Apply changes (${pendingCount})`}
          </button>
        </div>
      </div>
      {error ? <div style={{ color: "#b00020" }}>{error}</div> : null}
      {appliedMessage ? (
        <div style={{ color: "var(--muted)", fontSize: "12px" }}>{appliedMessage}</div>
      ) : null}

      <section style={{ padding: "12px", border: "1px solid #ddd", borderRadius: "8px" }}>
        <h2 style={{ marginTop: 0 }}>Gallery editor</h2>
        <GalleryEditor
          galleryId={gallery.galleryId}
          items={items}
          notes={[]}
          pendingItems={pendingItems}
          onStageItemFields={(itemKey, fields) =>
            setPendingItems((prev) => ({ ...prev, [itemKey]: fields }))
          }
        />
      </section>

      {showWalletMock ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 60,
          }}
          onClick={() => setShowWalletMock(false)}
        >
          <div
            style={{
              background: "var(--panel)",
              borderRadius: "10px",
              padding: "16px",
              maxWidth: "420px",
              width: "100%",
              display: "grid",
              gap: "12px",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ fontWeight: 600 }}>
              {walletMode ? "Wallet confirmation" : "Wallet confirmation (mock)"}
            </div>
            <div>
              {walletMode
                ? "This will submit the staged GalleryNFT updates with your connected wallet."
                : "This would submit on-chain updates to the GalleryNFT contract for all staged changes."}
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowWalletMock(false)}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowWalletMock(false);
                  await applyChanges();
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid #222",
                  background: "#111",
                  color: "#fff",
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
