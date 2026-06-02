import { NextResponse } from "next/server";
import { decodePackedRef, hashBytes20ToKt1 } from "@onchain-gallery/shared";
import { fetchEvmMetadataFallback, fetchEvmTokenUri } from "../../../../lib/alchemy";
import {
  fetchTezosTokenMetadata,
  fetchTokenMetadata,
  normalizeImageUrl,
  normalizeMetadata,
} from "../../../../lib/metadata";

type ResolveItemInput = {
  itemKey?: string;
  packedRefHex?: string;
};

async function resolveItem(input: ResolveItemInput) {
  if (!input.itemKey || !input.packedRefHex) {
    throw new Error("itemKey and packedRefHex are required");
  }

  const decoded = decodePackedRef(input.packedRefHex);
  let tokenUri: string | null = null;

  if (decoded.kind === "tezos") {
    const contractAddress = hashBytes20ToKt1(decoded.contractHash);
    const metadata = await fetchTezosTokenMetadata(contractAddress, decoded.tokenId.toString());
    return {
      itemKey: input.itemKey,
      tokenUri,
      metadataJson: metadata.raw,
      imageUrl: metadata.imageUrl,
      animationUrl: metadata.animationUrl,
      animationMime: metadata.animationMime,
      name: metadata.name,
      description: metadata.description,
      artist: metadata.artist,
      fetchError: null,
    };
  }

  try {
    tokenUri = await fetchEvmTokenUri(
      Number(decoded.chainId),
      decoded.contractAddress,
      decoded.tokenId.toString()
    );
    const metadata = await fetchTokenMetadata(tokenUri);
    return {
      itemKey: input.itemKey,
      tokenUri,
      metadataJson: metadata.raw,
      imageUrl: metadata.imageUrl,
      animationUrl: metadata.animationUrl,
      animationMime: metadata.animationMime,
      name: metadata.name,
      description: metadata.description,
      artist: metadata.artist,
      fetchError: null,
    };
  } catch (_err) {
    const fallback = await fetchEvmMetadataFallback(
      Number(decoded.chainId),
      decoded.contractAddress,
      decoded.tokenId.toString()
    );
    const raw = fallback.metadata || {};
    const normalized = normalizeMetadata(raw as any);
    const candidate = fallback.tokenUri?.raw || fallback.tokenUri?.gateway || null;

    return {
      itemKey: input.itemKey,
      tokenUri:
        typeof candidate === "string" &&
        (candidate.startsWith("http") ||
          candidate.startsWith("ipfs://") ||
          candidate.startsWith("ar://") ||
          candidate.startsWith("data:"))
          ? candidate
          : null,
      metadataJson: raw,
      imageUrl: normalizeImageUrl(
        normalized.imageUrl || fallback.media?.[0]?.gateway || fallback.media?.[0]?.raw || null
      ),
      animationUrl: normalized.animationUrl || fallback.rawMetadata?.animation_url || null,
      animationMime: normalized.animationMime || null,
      name: normalized.name || fallback.title || null,
      description: normalized.description || fallback.description || null,
      artist: normalized.artist || null,
      fetchError: null,
    };
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { items?: ResolveItemInput[] };
    const inputs = Array.isArray(body.items) ? body.items.slice(0, 25) : [];
    const items = await Promise.all(
      inputs.map(async (input) => {
        try {
          return await resolveItem(input);
        } catch (err) {
          return {
            itemKey: input.itemKey || "",
            tokenUri: null,
            metadataJson: null,
            imageUrl: null,
            animationUrl: null,
            animationMime: null,
            name: null,
            description: null,
            artist: null,
            fetchError: err instanceof Error ? err.message : "Metadata resolution failed",
          };
        }
      })
    );

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Metadata resolution failed" },
      { status: 400 }
    );
  }
}
