"use client";

import { useEffect, useMemo, useState } from "react";
import { GalleryItem, GalleryNote } from "../lib/queries";
import { decodePackedRef } from "@onchain-gallery/shared";
import { getPackedRefDisplay } from "../lib/decode";
import { TokenUri } from "./TokenUri";
import { RemoveItemButton } from "./RemoveItemButton";
import { ItemFieldsForm } from "./ItemFieldsForm";
import { SummaryToggle } from "./SummaryToggle";

type EditorItem = GalleryItem & {
  decoded: ReturnType<typeof decodePackedRef>;
  summary: string;
  fullSummary: string;
};

function resolveMediaUrl(uri: string) {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.replace("ipfs://", "")}`;
  }
  if (uri.startsWith("ar://")) {
    return `https://arweave.net/${uri.replace("ar://", "")}`;
  }
  return uri;
}

function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

export function GalleryEditor({
  galleryId,
  items,
  notes,
  pendingItems,
  onStageItemFields,
}: {
  galleryId: number;
  items: GalleryItem[];
  notes: GalleryNote[];
  pendingItems: Record<
    string,
    { displayOrder: number | null; label: string; note: string }
  >;
  onStageItemFields: (
    itemKey: string,
    fields: { displayOrder: number | null; label: string; note: string }
  ) => void;
}) {
  const [list, setList] = useState<EditorItem[]>(() =>
    items.map((item) => ({
      ...item,
      decoded: decodePackedRef(item.packedRefHex),
      summary: getPackedRefDisplay(item.packedRefHex).summary,
      fullSummary: getPackedRefDisplay(item.packedRefHex).full,
    }))
  );
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [openMeta, setOpenMeta] = useState<EditorItem | null>(null);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(() => new Set());
  const [viewMode, setViewMode] = useState<"compact" | "detail">("detail");
  const [compactCols, setCompactCols] = useState(8);
  const viewModeStorageKey = `gallery:${galleryId}:editorViewMode`;

  useEffect(() => {
    function updateCols() {
      const width = window.innerWidth;
      if (width < 640) setCompactCols(2);
      else if (width < 900) setCompactCols(4);
      else if (width < 1100) setCompactCols(6);
      else setCompactCols(8);
    }
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  useEffect(() => {
    const saved =
      typeof window !== "undefined"
        ? window.localStorage.getItem(viewModeStorageKey)
        : null;
    if (saved === "compact" || saved === "detail") {
      setViewMode(saved);
    }
  }, [viewModeStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(viewModeStorageKey, viewMode);
  }, [viewMode, viewModeStorageKey]);

  useEffect(() => {
    function handleAdded(event: Event) {
      const detail = (event as CustomEvent).detail as GalleryItem | undefined;
      if (!detail || detail.galleryId !== galleryId) return;
      setPendingKeys((prev) => new Set(prev).add(detail.itemKey));
      setList((prev) => {
        if (prev.some((item) => item.itemKey === detail.itemKey)) {
          return prev;
        }
        const decoded = decodePackedRef(detail.packedRefHex);
        const display = getPackedRefDisplay(detail.packedRefHex);
        return [
          ...prev,
          {
            ...detail,
            decoded,
            summary: display.summary,
            fullSummary: display.full,
          } as EditorItem,
        ];
      });
    }
    window.addEventListener("gallery:item-added", handleAdded as EventListener);
    return () => {
      window.removeEventListener("gallery:item-added", handleAdded as EventListener);
    };
  }, [galleryId]);

  useEffect(() => {
    const incomingMap = new Map(items.map((item) => [item.itemKey, item]));
    setPendingKeys((prev) => {
      const next = new Set(prev);
      for (const key of incomingMap.keys()) {
        if (next.has(key)) next.delete(key);
      }
      return next;
    });
    setList((prev) => {
      const merged: EditorItem[] = [];
      for (const existing of prev) {
        const incoming = incomingMap.get(existing.itemKey);
        if (incoming) {
          merged.push({
            ...existing,
            ...incoming,
            decoded: existing.decoded,
            summary: existing.summary,
            fullSummary: existing.fullSummary,
          });
          incomingMap.delete(existing.itemKey);
        } else {
          merged.push(existing);
        }
      }
      for (const incoming of incomingMap.values()) {
        const packedRefDisplay = getPackedRefDisplay(incoming.packedRefHex);
        merged.push({
          ...incoming,
          decoded: decodePackedRef(incoming.packedRefHex),
          summary: packedRefDisplay.summary,
          fullSummary: packedRefDisplay.full,
        });
      }
      return merged;
    });
  }, [items]);

  function handleDragStart(itemKey: string) {
    setDragKey(itemKey);
  }

  function handleDrop(targetKey: string) {
    if (!dragKey || dragKey === targetKey) return;
    const next = [...list];
    const from = next.findIndex((item) => item.itemKey === dragKey);
    const to = next.findIndex((item) => item.itemKey === targetKey);
    if (from === -1 || to === -1) return;
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const ordered = next.map((item, index) => ({
      ...item,
      displayOrder: index + 1,
    }));
    setList(ordered);
    for (const item of ordered) {
      onStageItemFields(item.itemKey, {
        displayOrder: item.displayOrder ?? null,
        label: item.label ?? "",
        note: item.note ?? "",
      });
    }
    setDragKey(null);
  }

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: "12px", color: "var(--muted)" }}>
          Reordering auto-stages the display order.
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            type="button"
            onClick={() => setViewMode("detail")}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: viewMode === "detail" ? "var(--text)" : "var(--panel)",
              color: viewMode === "detail" ? "var(--bg)" : "var(--text)",
            }}
          >
            Detail view
          </button>
          <button
            type="button"
            onClick={() => setViewMode("compact")}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: viewMode === "compact" ? "var(--text)" : "var(--panel)",
              color: viewMode === "compact" ? "var(--bg)" : "var(--text)",
            }}
          >
            Compact view
          </button>
        </div>
      </div>

      <div
        className="gallery-grid"
        data-view={viewMode}
        style={{
          display: "grid",
          gap: viewMode === "compact" ? "8px" : "12px",
          gridTemplateColumns:
            viewMode === "compact"
              ? `repeat(${compactCols}, minmax(0, 1fr))`
              : "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {list.map((item) => {
          const note = notes.find((n) => n.scope === 1 && n.targetKey === item.itemKey);
          const artist =
            (item.metadataJson as any)?.artist ||
            (item.metadataJson as any)?.creator ||
            (item.metadataJson as any)?.created_by ||
            (item.metadataJson as any)?.attributes?.find?.(
              (attr: any) => attr?.trait_type?.toLowerCase?.() === "artist"
            )?.value;
          const animationUrl =
            (item.metadataJson as any)?.animation_url ||
            (item.metadataJson as any)?.animationUrl ||
            null;
          const resolvedImageUrl = item.imageUrl ? resolveMediaUrl(item.imageUrl) : null;
          const resolvedAnimationUrl = animationUrl ? resolveMediaUrl(animationUrl) : null;
          const previewVideoUrl = resolvedImageUrl && isVideoUrl(resolvedImageUrl)
            ? resolvedImageUrl
            : resolvedAnimationUrl && isVideoUrl(resolvedAnimationUrl)
              ? resolvedAnimationUrl
              : null;
          const previewImageUrl = previewVideoUrl ? null : resolvedImageUrl;
          const title =
            pendingItems[item.itemKey]?.label ||
            item.label ||
            item.name ||
            item.summary ||
            "Untitled item";
          const truncatedTitle =
            title.length > 28 ? `${title.slice(0, 25)}…` : title;

          return (
            <div
              key={item.itemKey}
              draggable
              onDragStart={() => handleDragStart(item.itemKey)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(item.itemKey)}
              style={{
                padding: viewMode === "compact" ? "6px" : "10px",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                background:
                  dragKey === item.itemKey ? "var(--panel-2)" : "var(--panel)",
                cursor: "grab",
              }}
            >
              {viewMode === "compact" ? (
                <div style={{ display: "grid", gap: "6px" }}>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      background: "var(--panel-2)",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {previewVideoUrl ? (
                      <video
                        src={previewVideoUrl}
                        muted
                        loop
                        playsInline
                        autoPlay
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : previewImageUrl ? (
                      <img
                        src={previewImageUrl}
                        alt={item.name || item.label || "NFT"}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ fontSize: "11px", color: "var(--muted)" }}>No preview</div>
                    )}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "11px" }}>{truncatedTitle}</div>
                  {pendingKeys.has(item.itemKey) ? (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#8a6d3b",
                        background: "#fcf8e3",
                        border: "1px solid #faebcc",
                        borderRadius: "999px",
                        padding: "2px 8px",
                        width: "fit-content",
                      }}
                    >
                      Syncing…
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      background: "var(--panel-2)",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      marginBottom: "10px",
                    }}
                  >
                    {previewVideoUrl ? (
                      <video
                        src={previewVideoUrl}
                        muted
                        loop
                        playsInline
                        autoPlay
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : previewImageUrl ? (
                      <img
                        src={previewImageUrl}
                        alt={item.name || item.label || "NFT"}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ fontSize: "12px", color: "var(--muted)" }}>No preview</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <div style={{ fontWeight: 600 }}>
                      {pendingItems[item.itemKey]?.label || item.label || "Untitled item"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>
                      #{item.itemKey.slice(2, 8)}
                    </div>
                    {artist ? <div style={{ fontSize: "12px" }}>Artist: {artist}</div> : null}
                    {pendingKeys.has(item.itemKey) ? (
                      <div
                        style={{
                          fontSize: "12px",
                        color: "#8a6d3b",
                        background: "#fcf8e3",
                        border: "1px solid #faebcc",
                          borderRadius: "999px",
                          padding: "2px 8px",
                        }}
                      >
                        Syncing…
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setOpenMeta(item)}
                      style={{
                        marginLeft: "auto",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                      }}
                    >
                      View details
                    </button>
                  </div>
                  <SummaryToggle summary={item.summary} full={item.fullSummary} />
                  {(pendingItems[item.itemKey]?.note || item.note) ? (
                    <div>{pendingItems[item.itemKey]?.note || item.note}</div>
                  ) : null}
                  {note ? <div style={{ marginTop: "6px" }}>{note.noteText}</div> : null}
                  {item.decoded.kind === "evm" ? (
                    <TokenUri
                      tokenUri={item.tokenUri}
                      refreshUrl={`/api/galleries/${galleryId}/items/${item.itemKey}/refresh`}
                    />
                  ) : (
                    <div style={{ color: "#666" }}>Token URI: not available for Tezos yet.</div>
                  )}
                  {animationUrl ? (
                    <button
                      type="button"
                      onClick={() => setOpenMeta(item)}
                      style={{
                        width: "fit-content",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                      }}
                    >
                      View interactive
                    </button>
                  ) : null}
                  <ItemFieldsForm
                    galleryId={galleryId}
                    itemKey={item.itemKey}
                    displayOrder={
                      pendingItems[item.itemKey]?.displayOrder ??
                      item.displayOrder ??
                      null
                    }
                    label={pendingItems[item.itemKey]?.label ?? item.label ?? ""}
                    note={pendingItems[item.itemKey]?.note ?? item.note ?? ""}
                    onStage={onStageItemFields}
                  />
                  <RemoveItemButton galleryId={galleryId} itemKey={item.itemKey} />
                </>
              )}
            </div>
          );
        })}
      </div>

      {openMeta ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            zIndex: 50,
          }}
          onClick={() => setOpenMeta(null)}
        >
          <div
            style={{
              background: "var(--panel)",
              borderRadius: "10px",
              padding: "16px",
              maxWidth: "720px",
              width: "100%",
              maxHeight: "80vh",
              overflow: "auto",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 600 }}>{openMeta.name || openMeta.label || "Item"}</div>
              <button
                type="button"
                onClick={() => setOpenMeta(null)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "var(--panel-2)",
                  color: "var(--text)",
                }}
              >
                Close
              </button>
            </div>
            {(() => {
              const rawAnimationUrl =
                (openMeta.metadataJson as any)?.animation_url ||
                (openMeta.metadataJson as any)?.animationUrl ||
                null;
              if (!rawAnimationUrl) return null;
              const resolved = resolveMediaUrl(rawAnimationUrl);
              const animationFormat = (openMeta.metadataJson as any)?.animation_details?.format
                ?.toLowerCase?.();
              const isHtml =
                animationFormat === "html" ||
                resolved.endsWith(".html") ||
                resolved.includes(".html?");
              const isVideo =
                animationFormat === "mp4" ||
                animationFormat === "video" ||
                /\.(mp4|webm|mov)(\?|#|$)/i.test(resolved);

              return (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ fontWeight: 600, marginBottom: "6px" }}>
                    Interactive preview
                  </div>
                  {isHtml ? (
                    <iframe
                      src={resolved}
                      title="Interactive NFT"
                      sandbox="allow-scripts"
                      style={{
                        width: "100%",
                        height: "420px",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                      }}
                    />
                  ) : isVideo ? (
                    <video
                      src={resolved}
                      controls
                      style={{
                        width: "100%",
                        maxHeight: "420px",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        background: "#000",
                      }}
                    />
                  ) : (
                    <a href={resolved} target="_blank" rel="noreferrer">
                      Open media
                    </a>
                  )}
                </div>
              );
            })()}
            <pre style={{ whiteSpace: "pre-wrap", marginTop: "12px" }}>
{JSON.stringify(openMeta.metadataJson || {}, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}

    </div>
  );
}
