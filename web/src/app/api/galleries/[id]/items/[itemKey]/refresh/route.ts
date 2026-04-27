import { NextResponse } from "next/server";
import { refreshGalleryItemMetadata } from "../../../../../../../lib/queries";

export async function POST(
  _request: Request,
  { params }: { params: { id: string; itemKey: string } }
) {
  const galleryId = Number(params.id);
  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  try {
    const updated = await refreshGalleryItemMetadata(galleryId, params.itemKey);
    if (!updated) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to refresh metadata" },
      { status: 400 }
    );
  }
}
