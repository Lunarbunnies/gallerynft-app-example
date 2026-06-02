import { NextResponse } from "next/server";
import { fetchIndexedGallery } from "../../../../../../lib/indexedQueries";

export async function GET(
  _request: Request,
  { params }: { params: { collection: string; galleryId: string } }
) {
  const galleryId = Number(params.galleryId);
  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  try {
    const payload = await fetchIndexedGallery(params.collection, galleryId);
    if (!payload.gallery) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load indexed gallery" },
      { status: 500 }
    );
  }
}
