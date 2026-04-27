import { reader } from "../../../lib/chain";
import { FrameViewer } from "../../../components/FrameViewer";
import { getPackedRefDisplay } from "../../../lib/decode";

export default async function EmbedFramePage({
  params,
  searchParams,
}: {
  params: { galleryId: string };
  searchParams?: { interval?: string };
}) {
  const galleryId = Number(params.galleryId);
  const payload = await reader.getFramePayload(galleryId);
  const intervalSeconds = Number(searchParams?.interval ?? "30");

  if (!payload.gallery) {
    return <div>Gallery not found.</div>;
  }

  const items = payload.items
    .filter((item) => item.removedAt === 0)
    .map((item) => {
      const display = getPackedRefDisplay(item.packedRefHex);
      return {
        itemKey: item.itemKey,
        packedRefHex: item.packedRefHex,
        summary: display.summary,
        fullSummary: display.full,
        imageUrl: item.imageUrl ?? null,
        name: item.name ?? null,
        description: item.description ?? null,
        label: item.label ?? null,
        note: item.note ?? null,
        metadataJson: item.metadataJson ?? null,
      };
    });

  return (
    <main style={{ padding: 0, margin: 0 }}>
      <FrameViewer
        items={items}
        galleryNote={undefined}
        itemNotes={[]}
        intervalSeconds={Number.isFinite(intervalSeconds) ? intervalSeconds : 30}
      />
    </main>
  );
}
