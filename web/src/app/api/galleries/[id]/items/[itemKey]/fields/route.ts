import { NextResponse } from "next/server";
import { appendMockEvents } from "../../../../../../../lib/mockEvents";

export async function POST(
  request: Request,
  { params }: { params: { id: string; itemKey: string } }
) {
  const galleryId = Number(params.id);
  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.label !== "string" || typeof body.note !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    appendMockEvents([
      {
        type: "ItemFieldsUpdated",
        galleryId,
        itemKey: params.itemKey,
        displayOrder:
          body.displayOrder === null || body.displayOrder === ""
            ? null
            : Number(body.displayOrder),
        label: body.label,
        note: body.note,
      },
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update item" },
      { status: 400 }
    );
  }
}
