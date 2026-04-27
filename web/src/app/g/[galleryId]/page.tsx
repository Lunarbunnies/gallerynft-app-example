import Link from "next/link";
import { GalleryEditor } from "../../../components/GalleryEditor";
import { reader } from "../../../lib/chain";
import { GalleryWorkspace } from "../../../components/GalleryWorkspace";

export default async function GalleryPage({
  params,
}: {
  params: { galleryId: string };
}) {
  const galleryId = Number(params.galleryId);
  const gallery = await reader.getGallery(galleryId);
  const items = await reader.getGalleryItems(galleryId);

  if (!gallery) {
    return <div>Gallery not found.</div>;
  }

  return (
    <main style={{ display: "grid", gap: "16px" }}>
      <Link href="/">Back</Link>
      <GalleryWorkspace gallery={gallery} items={items} />
    </main>
  );
}
