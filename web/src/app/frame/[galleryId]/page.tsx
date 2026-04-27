import Link from "next/link";
import { FrameViewer } from "../../../components/FrameViewer";
import { getPackedRefDisplay } from "../../../lib/decode";
import { reader } from "../../../lib/chain";

export default async function FramePage({
  params,
  searchParams,
}: {
  params: { galleryId: string };
  searchParams: { interval?: string };
}) {
  const galleryId = Number(params.galleryId);
  const intervalSeconds = Number(searchParams.interval) || 30;
  const payload = await reader.getFramePayload(galleryId);

  if (!payload.gallery) {
    return <div>Gallery not found.</div>;
  }

  return (
    <main style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <Link href={`/g/${galleryId}`}>Back to gallery</Link>
        <span>Interval: {intervalSeconds}s</span>
      </div>
      <FrameViewer
        items={payload.items.map((item) => ({
          ...item,
          ...getPackedRefDisplay(item.packedRefHex),
          imageUrl: item.imageUrl,
          name: item.name,
          description: item.description,
          label: item.label,
          note: item.note,
          metadataJson: item.metadataJson,
        }))}
        galleryNote={payload.galleryNote}
        itemNotes={payload.itemNotes}
        intervalSeconds={intervalSeconds}
      />
    </main>
  );
}
