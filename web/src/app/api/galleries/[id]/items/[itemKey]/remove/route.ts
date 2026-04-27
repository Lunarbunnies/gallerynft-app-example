import { NextResponse } from "next/server";
import { appendMockEvents } from "../../../../../../../lib/mockEvents";
import { removeGalleryItem } from "../../../../../../../lib/queries";

export async function POST(
  _request: Request,
  { params }: { params: { id: string; itemKey: string } }
) {
  const galleryId = Number(params.id);
  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  try {
    const removed = await removeGalleryItem(galleryId, params.itemKey);
    if (!removed) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    appendMockEvents([
      {
        type: "ItemRemoved",
        galleryId,
        itemKey: params.itemKey,
        removedAt: Math.floor(Date.now() / 1000),
      },
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to remove item" },
      { status: 400 }
    );
  }
}
