import { NextResponse } from "next/server";
import { reader } from "../../../lib/chain";
import { appendMockEvents, getNextGalleryId } from "../../../lib/mockEvents";

export async function GET() {
  const galleries = await reader.listGalleries();
  return NextResponse.json({ galleries });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.owner !== "string" ||
    body.owner.trim().length === 0 ||
    typeof body.title !== "string" ||
    typeof body.description !== "string"
  ) {
    return NextResponse.json(
      { error: "Owner, title, and description are required" },
      { status: 400 }
    );
  }

  try {
    const galleryId = getNextGalleryId();
    const now = Math.floor(Date.now() / 1000);
    appendMockEvents([
      {
        type: "GalleryCreated",
        galleryId,
        owner: body.owner.trim(),
        createdAt: now,
      },
      {
        type: "GalleryFieldsUpdated",
        galleryId,
        title: body.title.trim(),
        description: body.description.trim(),
        updatedAt: now,
      },
    ]);
    return NextResponse.json({ ok: true, galleryId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create gallery" },
      { status: 400 }
    );
  }
}
