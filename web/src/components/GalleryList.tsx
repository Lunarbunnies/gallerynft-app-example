import Link from "next/link";
import { GallerySummary } from "../lib/queries";

export function GalleryList({ galleries }: { galleries: GallerySummary[] }) {
  return (
    <div style={{ display: "grid", gap: "12px" }}>
      {galleries.map((gallery) => (
        <div
          key={gallery.galleryId}
          style={{
            padding: "12px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            background: "var(--panel)",
          }}
        >
          <div>Gallery #{gallery.galleryId}</div>
          {gallery.title ? <div>{gallery.title}</div> : null}
          <div>Owner: {gallery.owner}</div>
          <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
            <Link href={`/g/${gallery.galleryId}`}>View details</Link>
            <Link href={`/frame/${gallery.galleryId}`}>Frame mode</Link>
          </div>
        </div>
      ))}
    </div>
  );
}
