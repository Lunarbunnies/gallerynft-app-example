"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  async function handleRemove() {
    setIsRemoving(true);
    setError(null);
    try {
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
        {isRemoving ? "Removing..." : "Remove item"}
      </button>
      {error ? <div style={{ color: "#b00020" }}>{error}</div> : null}
    </div>
  );
}
