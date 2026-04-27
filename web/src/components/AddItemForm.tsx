"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  galleryId: number;
  onCreated?: () => void;
};

function chainIdFromOpenSeaNetwork(network: string) {
  const key = network.toLowerCase();
  if (key === "ethereum") return "1";
  if (key === "sepolia") return "11155111";
  if (key === "base") return "8453";
  if (key === "matic" || key === "polygon") return "137";
  return null;
}

function parseNftUrl(input: string):
  | { kind: "evm"; chainId: string; contractAddress: string; tokenId: string }
  | { kind: "tezos"; tezosNet: string; contractAddress: string; tokenId: string }
  | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  if (host.includes("opensea.io")) {
    if (parts[0] === "item" && parts.length >= 4) {
      const chainId = chainIdFromOpenSeaNetwork(parts[1]);
      if (!chainId) return null;
      return {
        kind: "evm",
        chainId,
        contractAddress: parts[2],
        tokenId: parts[3],
      };
    }
    if (parts[0] === "assets" && parts.length >= 4) {
      const chainId = chainIdFromOpenSeaNetwork(parts[1]) || "1";
      return {
        kind: "evm",
        chainId,
        contractAddress: parts[2],
        tokenId: parts[3],
      };
    }
  }

  if (host.includes("objkt.com")) {
    if (parts[0] === "tokens" && parts.length >= 3) {
      return {
        kind: "tezos",
        tezosNet: "1",
        contractAddress: parts[1],
        tokenId: parts[2],
      };
    }
  }

  return null;
}

export function AddItemForm({ galleryId, onCreated }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<"evm" | "tezos">("evm");
  const [chainId, setChainId] = useState("1");
  const [contractAddress, setContractAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [tezosNet, setTezosNet] = useState("1");
  const [tezosContract, setTezosContract] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [autofillMessage, setAutofillMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleAutofill() {
    setAutofillMessage(null);
    setError(null);
    const parsed = parseNftUrl(referenceUrl);
    if (!parsed) {
      setError("Could not parse URL. Use an OpenSea or objkt token link.");
      return;
    }

    setTokenId(parsed.tokenId);
    if (parsed.kind === "evm") {
      setKind("evm");
      setChainId(parsed.chainId);
      setContractAddress(parsed.contractAddress);
      setAutofillMessage("Autofilled EVM chain, contract, and token ID.");
      return;
    }

    setKind("tezos");
    setTezosNet(parsed.tezosNet);
    setTezosContract(parsed.contractAddress);
    setAutofillMessage("Autofilled Tezos contract and token ID.");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const body =
        kind === "evm"
          ? {
              kind,
              chainId,
              contractAddress,
              tokenId,
              displayOrder,
              label,
              note,
            }
          : {
              kind,
              tezosNet,
              contractAddress: tezosContract,
              tokenId,
              displayOrder,
              label,
              note,
            };

      const response = await fetch(`/api/galleries/${galleryId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to add item");
      }

      const payload = await response.json();
      if (payload?.item) {
        window.dispatchEvent(
          new CustomEvent("gallery:item-added", { detail: payload.item })
        );
      }

      setContractAddress("");
      setTokenId("");
      setTezosContract("");
      setDisplayOrder("");
      setLabel("");
      setNote("");
      onCreated?.();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px", maxWidth: "520px" }}>
      <div
        style={{
          display: "grid",
          gap: "6px",
          padding: "8px",
          border: "1px dashed var(--border)",
          borderRadius: "8px",
          background: "var(--panel-2)",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
          Paste OpenSea/objkt URL to autofill
        </span>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            value={referenceUrl}
            onChange={(event) => setReferenceUrl(event.target.value)}
            placeholder="https://opensea.io/item/... or https://objkt.com/tokens/..."
            style={{
              flex: "1 1 320px",
              padding: "8px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
            }}
          />
          <button
            type="button"
            onClick={handleAutofill}
            style={{
              padding: "8px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "var(--panel)",
            }}
          >
            Autofill
          </button>
        </div>
        {autofillMessage ? (
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>{autofillMessage}</div>
        ) : null}
      </div>

      <label style={{ display: "grid", gap: "6px" }}>
        <span>Chain type</span>
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as "evm" | "tezos")}
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
        >
          <option value="evm">EVM NFT</option>
          <option value="tezos">Tezos FA2</option>
        </select>
      </label>

      {kind === "evm" ? (
        <>
          <label style={{ display: "grid", gap: "6px" }}>
            <span>Chain</span>
            <select
              value={chainId}
              onChange={(event) => setChainId(event.target.value)}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              required
            >
              <option value="1">Ethereum Mainnet (1)</option>
              <option value="11155111">Sepolia (11155111)</option>
              <option value="8453">Base (8453)</option>
              <option value="137">Polygon (137)</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span>Contract address</span>
            <input
              value={contractAddress}
              onChange={(event) => setContractAddress(event.target.value)}
              placeholder="0x..."
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              required
            />
          </label>
        </>
      ) : (
        <>
          <label style={{ display: "grid", gap: "6px" }}>
            <span>Tezos network</span>
            <input
              value={tezosNet}
              onChange={(event) => setTezosNet(event.target.value)}
              placeholder="1"
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              required
            />
          </label>
          <label style={{ display: "grid", gap: "6px" }}>
            <span>KT1 contract</span>
            <input
              value={tezosContract}
              onChange={(event) => setTezosContract(event.target.value)}
              placeholder="KT1..."
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
              required
            />
          </label>
        </>
      )}

      <label style={{ display: "grid", gap: "6px" }}>
        <span>Token ID</span>
        <input
          value={tokenId}
          onChange={(event) => setTokenId(event.target.value)}
          placeholder="123"
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          required
        />
      </label>
      <label style={{ display: "grid", gap: "6px" }}>
        <span>Display order (optional)</span>
        <input
          value={displayOrder}
          onChange={(event) => setDisplayOrder(event.target.value)}
          placeholder="1"
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
        />
      </label>
      <label style={{ display: "grid", gap: "6px" }}>
        <span>Label</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Short label"
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          required
        />
      </label>
      <label style={{ display: "grid", gap: "6px" }}>
        <span>Note</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Longer note"
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          rows={3}
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
          border: "1px solid var(--border)",
          background: isSubmitting ? "var(--panel-2)" : "var(--text)",
          color: isSubmitting ? "var(--muted)" : "var(--bg)",
        }}
      >
        {isSubmitting ? "Adding..." : "Add item"}
      </button>
    </form>
  );
}
