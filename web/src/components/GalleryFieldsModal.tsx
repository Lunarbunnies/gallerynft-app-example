"use client";

import { useState } from "react";
import { GalleryFieldsForm } from "./GalleryFieldsForm";

export function GalleryFieldsModal({
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
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: "var(--panel)",
        }}
      >
        Edit gallery
      </button>

      {open ? (
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
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: "var(--panel)",
              borderRadius: "10px",
              padding: "16px",
              maxWidth: "640px",
              width: "100%",
              maxHeight: "85vh",
              overflow: "auto",
            }}
            onClick={(event) => event.stopPropagation()}
          >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600 }}>Edit gallery fields</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                }}
              >
                Close
              </button>
            </div>
            <div style={{ marginTop: "12px" }}>
              <GalleryFieldsForm
                galleryId={galleryId}
                title={title}
                description={description}
                onStage={(payload) => {
                  onStage?.(payload);
                  setOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
