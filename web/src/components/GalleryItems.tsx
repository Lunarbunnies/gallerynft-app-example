import { decodePackedRef } from "@onchain-gallery/shared";
import { GalleryItem, GalleryNote } from "../lib/queries";
import { formatPackedRefSummary } from "../lib/decode";
import { TokenUri } from "./TokenUri";
import { RemoveItemButton } from "./RemoveItemButton";
import { ItemFieldsForm } from "./ItemFieldsForm";

type ItemWithDecode = GalleryItem & {
  decoded: ReturnType<typeof decodePackedRef>;
  summary: string;
};

export function GalleryItems({
  items,
  notes,
}: {
  items: GalleryItem[];
  notes: GalleryNote[];
}) {
  const enriched: ItemWithDecode[] = items.map((item) => ({
    ...item,
    decoded: decodePackedRef(item.packedRefHex),
    summary: formatPackedRefSummary(item.packedRefHex),
  }));
  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {enriched.map((item) => {
        const note = notes.find((n) => n.scope === 1 && n.targetKey === item.itemKey);
        return (
          <div
            key={item.itemKey}
            style={{
              padding: "12px",
              border: "1px solid #222",
              borderRadius: "8px",
              background: "#f8f8f8",
            }}
          >
            <div>{item.summary}</div>
            {item.label ? <div style={{ fontWeight: 600 }}>{item.label}</div> : null}
            {item.name ? <div style={{ fontWeight: 600 }}>{item.name}</div> : null}
            <div style={{ fontSize: "12px", color: "#555" }}>{item.itemKey}</div>
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name || "NFT"}
                style={{ maxWidth: "240px", borderRadius: "8px", marginTop: "8px" }}
              />
            ) : null}
            {item.description ? <div>{item.description}</div> : null}
            {item.note ? <div>{item.note}</div> : null}
            {note ? <div style={{ marginTop: "6px" }}>{note.noteText}</div> : null}
            {item.decoded.kind === "evm" ? (
              <TokenUri
                tokenUri={item.tokenUri}
                refreshUrl={`/api/galleries/${item.galleryId}/items/${item.itemKey}/refresh`}
              />
            ) : (
              <div style={{ color: "#666" }}>Token URI: not available for Tezos yet.</div>
            )}
            <ItemFieldsForm
              galleryId={item.galleryId}
              itemKey={item.itemKey}
              displayOrder={item.displayOrder ?? null}
              label={item.label ?? ""}
              note={item.note ?? ""}
            />
            <RemoveItemButton galleryId={item.galleryId} itemKey={item.itemKey} />
          </div>
        );
      })}
    </div>
  );
}
