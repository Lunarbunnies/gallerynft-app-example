"use client";

import { useState } from "react";
import { AddItemForm } from "./AddItemForm";

export function AddItemModal({ galleryId }: { galleryId: number }) {
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
          background: "var(--text)",
          color: "var(--bg)",
        }}
      >
        Add item
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
              <div style={{ fontWeight: 600 }}>Add item</div>
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
              <AddItemForm
                galleryId={galleryId}
                onCreated={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
