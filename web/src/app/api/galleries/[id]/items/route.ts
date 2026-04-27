import { NextResponse } from "next/server";
import { appendMockEvents } from "../../../../../lib/mockEvents";
import { encodePackedRef, itemKey, kt1ToHashBytes20, hexToBytes } from "@onchain-gallery/shared";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const galleryId = Number(params.id);
  if (!Number.isFinite(galleryId)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.kind !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    let packed: Uint8Array;
    if (body.kind === "evm") {
      packed = encodePackedRef({
        kind: "evm",
        chainId: BigInt(body.chainId),
        contractAddress: body.contractAddress,
        tokenId: BigInt(body.tokenId),
      });
    } else {
      const contract = body.contractAddress.trim();
      const contractHash = contract.startsWith("KT1")
        ? kt1ToHashBytes20(contract)
        : hexToBytes(contract);
      packed = encodePackedRef({
        kind: "tezos",
        tezosNet: Number(body.tezosNet),
        contractHash,
        tokenId: BigInt(body.tokenId),
      });
    }

    const key = itemKey(packed);
    appendMockEvents([
      {
        type: "ItemAdded",
        galleryId,
        itemKey: key,
        packedRefHex: `0x${Buffer.from(packed).toString("hex")}`,
        addedAt: now,
      },
      {
        type: "ItemFieldsUpdated",
        galleryId,
        itemKey: key,
        displayOrder: body.displayOrder ? Number(body.displayOrder) : null,
        label: body.label || "",
        note: body.note || "",
      },
    ]);

    return NextResponse.json({
      ok: true,
      item: {
        galleryId,
        itemKey: key,
        packedRefHex: `0x${Buffer.from(packed).toString("hex")}`,
        addedAt: now,
        displayOrder: body.displayOrder ? Number(body.displayOrder) : null,
        label: body.label || "",
        note: body.note || "",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add item" },
      { status: 400 }
    );
  }
}
