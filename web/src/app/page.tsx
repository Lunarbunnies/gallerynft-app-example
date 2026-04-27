import { GalleryList } from "../components/GalleryList";
import { reader } from "../lib/chain";

export default async function HomePage() {
  const galleries = await reader.listGalleries();

  return (
    <main style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>On-Chain Gallery</h1>
        <a
          href="/create"
          style={{
            padding: "6px 10px",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            textDecoration: "none",
            color: "var(--text)",
            background: "var(--panel)",
          }}
        >
          Create gallery
        </a>
      </div>
      <GalleryList galleries={galleries} />
    </main>
  );
}
