"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateGalleryForm() {
  const router = useRouter();
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/galleries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, title, description }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to create gallery");
      }

      const payload = await response.json();
      router.push(`/g/${payload.galleryId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px", maxWidth: "420px" }}>
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
