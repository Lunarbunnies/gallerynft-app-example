import { NextResponse } from "next/server";
import { fetchEvmTokenUri } from "../../../lib/alchemy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chainId = Number(searchParams.get("chainId"));
  const contract = searchParams.get("contract");
  const tokenId = searchParams.get("tokenId");

  if (!chainId || !contract || !tokenId) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const tokenUri = await fetchEvmTokenUri(chainId, contract, tokenId);
    return NextResponse.json({ tokenUri });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch token URI" },
      { status: 400 }
    );
  }
}
