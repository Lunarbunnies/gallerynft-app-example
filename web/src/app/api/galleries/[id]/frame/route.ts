import { NextResponse } from "next/server";
import { reader } from "../../../../../lib/chain";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const galleryId = Number(params.id);
  const payload = await reader.getFramePayload(galleryId);
  if (!payload.gallery) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(payload);
}
