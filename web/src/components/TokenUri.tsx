"use client";

import { useState } from "react";

export function TokenUri({
  tokenUri,
  refreshUrl,
}: {
  tokenUri?: string | null;
  refreshUrl?: string;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isUri =
    typeof tokenUri === "string" &&
    (tokenUri.startsWith("http") ||
      tokenUri.startsWith("ipfs://") ||
      tokenUri.startsWith("ar://") ||
      tokenUri.startsWith("data:"));

  if (!isUri) {
    return (
      <div style={{ display: "grid", gap: "6px", color: "#666" }}>
        <div>Token URI unavailable (non-standard NFT).</div>
        {refreshUrl ? (
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              width: "fit-content",
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #222",
              background: isRefreshing ? "#eee" : "#fff",
            }}
          >
            {isRefreshing ? "Refreshing..." : "Refresh metadata"}
          </button>
        ) : null}
      </div>
    );
  }

  async function handleRefresh() {
    if (!refreshUrl) return;
    setIsRefreshing(true);
    try {
      await fetch(refreshUrl, { method: "POST" });
    } finally {
      setIsRefreshing(false);
    }
  }

  const displayUri =
    tokenUri.length > 120 ? `${tokenUri.slice(0, 60)}…${tokenUri.slice(-40)}` : tokenUri;

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <div>
        Token URI: <span style={{ wordBreak: "break-all" }}>{displayUri}</span>
      </div>
      {refreshUrl ? (
        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            width: "fit-content",
            padding: "6px 10px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: isRefreshing ? "var(--panel-2)" : "var(--panel)",
          }}
        >
          {isRefreshing ? "Refreshing..." : "Refresh metadata"}
        </button>
      ) : null}
    </div>
  );
}
