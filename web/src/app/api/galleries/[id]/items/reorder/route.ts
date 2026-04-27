import { NextResponse } from "next/server";
import { appendMockEvents } from "../../../../../../lib/mockEvents";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const galleryId = Number(params.id);
  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const events = body.items.map((item: any) => ({
      type: "ItemFieldsUpdated",
      galleryId,
      itemKey: String(item.itemKey),
      displayOrder: Number(item.displayOrder),
      label: String(item.label ?? ""),
      note: String(item.note ?? ""),
    }));

    appendMockEvents(events);
    return NextResponse.json({ ok: true, count: events.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to reorder items" },
      { status: 400 }
    );
  }
}
