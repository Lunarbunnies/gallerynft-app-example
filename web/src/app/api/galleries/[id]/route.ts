import { NextResponse } from "next/server";
import { reader } from "../../../../lib/chain";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const galleryId = Number(params.id);
  const gallery = await reader.getGallery(galleryId);
  const items = await reader.getGalleryItems(galleryId);
  if (!gallery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ gallery, items });
}
