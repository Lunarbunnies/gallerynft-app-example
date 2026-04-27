"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function GalleryFieldsForm({
  galleryId,
  title,
  description,
  onStage,
}: {
  galleryId: number;
  title: string | null | undefined;
  description: string | null | undefined;
  onStage?: (payload: { title: string; description: string }) => void;
}) {
  const router = useRouter();
  const [nextTitle, setNextTitle] = useState(title || "");
  const [nextDescription, setNextDescription] = useState(description || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      if (onStage) {
        onStage({ title: nextTitle, description: nextDescription });
        return;
      }
      const response = await fetch(`/api/galleries/${galleryId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle, description: nextDescription }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to update gallery");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update gallery");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "10px" }}>
      <label style={{ display: "grid", gap: "6px" }}>
        <span>Title</span>
        <input
          value={nextTitle}
          onChange={(event) => setNextTitle(event.target.value)}
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
          required
        />
      </label>
      <label style={{ display: "grid", gap: "6px" }}>
        <span>Description</span>
        <textarea
          value={nextDescription}
          onChange={(event) => setNextDescription(event.target.value)}
          style={{ padding: "8px", borderRadius: "6px", border: "1px solid #ccc" }}
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
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: isSaving ? "var(--panel-2)" : "var(--text)",
          color: isSaving ? "var(--muted)" : "var(--bg)",
        }}
      >
        {isSaving ? "Saving..." : "Save gallery fields"}
      </button>
    </form>
  );
}
