import { NextResponse } from "next/server";
import { refreshIndexedGalleryMetadata } from "../../../../../../../lib/indexedQueries";

export async function POST(
  _request: Request,
  { params }: { params: { collection: string; galleryId: string } }
) {
  const galleryId = Number(params.galleryId);
  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await refreshIndexedGalleryMetadata(params.collection, galleryId)
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to refresh metadata" },
      { status: 500 }
    );
  }
}
