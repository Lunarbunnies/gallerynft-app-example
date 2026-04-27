"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ItemFieldsForm({
  galleryId,
  itemKey,
  displayOrder,
  label,
  note,
  onStage,
}: {
  galleryId: number;
  itemKey: string;
  displayOrder?: number | null;
  label?: string | null;
  note?: string | null;
  onStage?: (
    itemKey: string,
    fields: { displayOrder: number | null; label: string; note: string }
  ) => void;
}) {
  const router = useRouter();
  const [nextOrder, setNextOrder] = useState(displayOrder?.toString() || "");
  const [nextLabel, setNextLabel] = useState(label || "");
  const [nextNote, setNextNote] = useState(note || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      if (onStage) {
        onStage(itemKey, {
          displayOrder: nextOrder === "" ? null : Number(nextOrder),
          label: nextLabel,
          note: nextNote,
        });
        return;
      }
      const response = await fetch(`/api/galleries/${galleryId}/items/${itemKey}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayOrder: nextOrder === "" ? null : Number(nextOrder),
          label: nextLabel,
          note: nextNote,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update item");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "8px" }}>
      <label style={{ display: "grid", gap: "4px" }}>
        <span>Display order</span>
        <input
          value={nextOrder}
          onChange={(event) => setNextOrder(event.target.value)}
          style={{ padding: "6px", borderRadius: "6px", border: "1px solid #ccc" }}
        />
      </label>
      <label style={{ display: "grid", gap: "4px" }}>
        <span>Label</span>
        <input
          value={nextLabel}
          onChange={(event) => setNextLabel(event.target.value)}
          style={{ padding: "6px", borderRadius: "6px", border: "1px solid #ccc" }}
          required
        />
      </label>
      <label style={{ display: "grid", gap: "4px" }}>
        <span>Note</span>
        <textarea
          value={nextNote}
          onChange={(event) => setNextNote(event.target.value)}
          style={{ padding: "6px", borderRadius: "6px", border: "1px solid #ccc" }}
          rows={3}
          required
        />
      </label>
      {error ? <div style={{ color: "#b00020" }}>{error}</div> : null}
      <button
        type="submit"
        disabled={isSaving}
        style={{
          width: "fit-content",
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: isSaving ? "var(--panel-2)" : "var(--text)",
          color: isSaving ? "var(--muted)" : "var(--bg)",
        }}
      >
        {isSaving ? "Saving..." : "Save item fields"}
      </button>
    </form>
  );
}
