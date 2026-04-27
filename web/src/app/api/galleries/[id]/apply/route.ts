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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const events: any[] = [];

  if (body.gallery && typeof body.gallery.title === "string") {
    events.push({
      type: "GalleryFieldsUpdated",
      galleryId,
      title: body.gallery.title,
      description: body.gallery.description || "",
      updatedAt: Math.floor(Date.now() / 1000),
    });
  }

  if (body.items && typeof body.items === "object") {
    for (const [itemKey, fields] of Object.entries(
      body.items as Record<string, any>
    )) {
      events.push({
        type: "ItemFieldsUpdated",
        galleryId,
        itemKey,
        displayOrder:
          fields.displayOrder === null || fields.displayOrder === ""
            ? null
            : Number(fields.displayOrder),
        label: fields.label || "",
        note: fields.note || "",
      });
    }
  }

  if (events.length === 0) {
    return NextResponse.json({ ok: true, count: 0 });
  }

  try {
    appendMockEvents(events);
    return NextResponse.json({ ok: true, count: events.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to apply changes" },
      { status: 400 }
    );
  }
}
