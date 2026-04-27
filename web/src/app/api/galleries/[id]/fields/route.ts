import { NextResponse } from "next/server";
import { appendMockEvents } from "../../../../../lib/mockEvents";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const galleryId = Number(params.id);
  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== "string" || typeof body.description !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    appendMockEvents([
      {
        type: "GalleryFieldsUpdated",
        galleryId,
        title: body.title,
        description: body.description,
        updatedAt: Math.floor(Date.now() / 1000),
      },
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update gallery" },
      { status: 400 }
    );
  }
}
