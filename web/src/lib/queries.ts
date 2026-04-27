import { getPool, isSqliteDriver } from "./db";

export type GallerySummary = {
  galleryId: number;
  owner: string;
  title?: string | null;
  description?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type GalleryItem = {
  galleryId: number;
  itemKey: string;
  kind: number;
  packedRefHex: string;
  addedAt: number;
  removedAt?: number;
  displayOrder?: number | null;
  label?: string | null;
  note?: string | null;
  tokenUri?: string | null;
  metadataJson?: unknown | null;
  imageUrl?: string | null;
  name?: string | null;
  description?: string | null;
};

export type GalleryNote = {
  scope: number;
  targetKey: string;
  noteText: string;
  updatedAt: string;
};

export async function fetchGalleries(): Promise<GallerySummary[]> {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT gallery_id AS galleryId, owner_address AS owner, title, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM galleries
     ORDER BY gallery_id ASC`
  );
  return rows as GallerySummary[];
}

export async function createGallery(owner: string) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COALESCE(MAX(gallery_id), 0) AS maxId FROM galleries`
  );
  const maxId = (rows as Array<{ maxId: number }>)[0]?.maxId ?? 0;
  const galleryId = maxId + 1;

  const now = Math.floor(Date.now() / 1000);
  if (isSqliteDriver()) {
    await pool.execute(
      `INSERT INTO galleries (gallery_id, owner_address, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(gallery_id) DO UPDATE SET owner_address = excluded.owner_address, updated_at = excluded.updated_at`,
      [galleryId, owner, now, now]
    );
  } else {
    await pool.execute(
      `INSERT INTO galleries (gallery_id, owner_address, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE owner_address = VALUES(owner_address), updated_at = VALUES(updated_at)`,
      [galleryId, owner, now, now]
    );
  }

  return galleryId;
}

export async function createGalleryFields(galleryId: number, title: string, description: string) {
  const pool = getPool();
  await pool.execute(
    `UPDATE galleries SET title = ?, description = ?, updated_at = ? WHERE gallery_id = ?`,
    [title, description, Math.floor(Date.now() / 1000), galleryId]
  );
}

function parseBigInt(value: unknown, label: string) {
  if (typeof value === "string" && value.trim() !== "") {
    return BigInt(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  throw new Error(`${label} must be a number`);
}

type AddItemPayload =
  | {
      kind: "evm";
      chainId: string | number;
      contractAddress: string;
      tokenId: string | number;
    }
  | {
      kind: "tezos";
      tezosNet: string | number;
      contractAddress: string;
      tokenId: string | number;
    };

export async function addGalleryItem(galleryId: number, payload: AddItemPayload) {
  const { encodePackedRef, itemKey, kt1ToHashBytes20, hexToBytes } =
    await import("@onchain-gallery/shared");
  const { fetchEvmTokenUri, fetchEvmMetadataFallback } = await import("./alchemy");
  const { fetchTokenMetadata, normalizeMetadata, normalizeImageUrl } =
    await import("./metadata");

  if (payload.kind === "evm") {
    const packed = encodePackedRef({
      kind: "evm",
      chainId: parseBigInt(payload.chainId, "Chain ID"),
      contractAddress: payload.contractAddress,
      tokenId: parseBigInt(payload.tokenId, "Token ID"),
    });
    const itemKeyHex = itemKey(packed);
    const pool = getPool();
    let tokenUri: string | null = null;
    let metadataJson: unknown | null = null;
    let imageUrl: string | null = null;
    let name: string | null = null;
    let description: string | null = null;

    try {
      tokenUri = await fetchEvmTokenUri(
        Number(payload.chainId),
        payload.contractAddress,
        payload.tokenId
      );
      const metadata = await fetchTokenMetadata(tokenUri);
      metadataJson = metadata.raw;
      imageUrl = metadata.imageUrl;
      name = metadata.name;
      description = metadata.description;
    } catch (_err) {
      try {
        const fallback = await fetchEvmMetadataFallback(
          Number(payload.chainId),
          payload.contractAddress,
          payload.tokenId
        );
        const raw = fallback.metadata || {};
        const normalized = normalizeMetadata(raw);
        metadataJson = raw;
        imageUrl = normalizeImageUrl(
          normalized.imageUrl ||
            fallback.media?.[0]?.gateway ||
            fallback.media?.[0]?.raw ||
            null
        );
        name = normalized.name || fallback.title || null;
        description = normalized.description || fallback.description || null;
        const candidate = fallback.tokenUri?.raw || fallback.tokenUri?.gateway || null;
        if (
          typeof candidate === "string" &&
          (candidate.startsWith("http") ||
            candidate.startsWith("ipfs://") ||
            candidate.startsWith("ar://") ||
            candidate.startsWith("data:"))
        ) {
          tokenUri = candidate;
        } else {
          tokenUri = null;
        }
      } catch (_fallbackErr) {
        // best-effort
      }
    }
    const now = Math.floor(Date.now() / 1000);
    if (isSqliteDriver()) {
      await pool.execute(
        `INSERT INTO gallery_items (gallery_id, item_key, kind, packed_ref, added_at, removed_at, token_uri, metadata_json, image_url, name, description)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
         ON CONFLICT(gallery_id, item_key) DO UPDATE SET
           kind = excluded.kind,
           packed_ref = excluded.packed_ref,
           removed_at = 0,
           token_uri = excluded.token_uri,
           metadata_json = excluded.metadata_json,
           image_url = excluded.image_url,
           name = excluded.name,
           description = excluded.description`,
        [
          galleryId,
          itemKeyHex,
          0,
          Buffer.from(packed),
          now,
          tokenUri,
          metadataJson ? JSON.stringify(metadataJson) : null,
          imageUrl,
          name,
          description,
        ]
      );
    } else {
      await pool.execute(
        `INSERT INTO gallery_items (gallery_id, item_key, kind, packed_ref, added_at, removed_at, token_uri, metadata_json, image_url, name, description)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE kind = VALUES(kind), packed_ref = VALUES(packed_ref), removed_at = 0,
           token_uri = VALUES(token_uri), metadata_json = VALUES(metadata_json), image_url = VALUES(image_url),
           name = VALUES(name), description = VALUES(description)`,
        [
          galleryId,
          itemKeyHex,
          0,
          Buffer.from(packed),
          now,
          tokenUri,
          metadataJson ? JSON.stringify(metadataJson) : null,
          imageUrl,
          name,
          description,
        ]
      );
    }
    return itemKeyHex;
  }

  const contract = payload.contractAddress.trim();
  const contractHash =
    contract.startsWith("KT1") ? kt1ToHashBytes20(contract) : hexToBytes(contract);
  const packed = encodePackedRef({
    kind: "tezos",
    tezosNet: Number(payload.tezosNet),
    contractHash,
    tokenId: parseBigInt(payload.tokenId, "Token ID"),
  });
  const itemKeyHex = itemKey(packed);
  const pool = getPool();
  const now = Math.floor(Date.now() / 1000);
  if (isSqliteDriver()) {
    await pool.execute(
      `INSERT INTO gallery_items (gallery_id, item_key, kind, packed_ref, added_at, removed_at)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(gallery_id, item_key) DO UPDATE SET
         kind = excluded.kind, packed_ref = excluded.packed_ref, removed_at = 0`,
      [galleryId, itemKeyHex, 1, Buffer.from(packed), now]
    );
  } else {
    await pool.execute(
      `INSERT INTO gallery_items (gallery_id, item_key, kind, packed_ref, added_at, removed_at)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE kind = VALUES(kind), packed_ref = VALUES(packed_ref), removed_at = 0`,
      [galleryId, itemKeyHex, 1, Buffer.from(packed), now]
    );
  }
  return itemKeyHex;
}

export async function refreshGalleryItemMetadata(
  galleryId: number,
  itemKey: string
) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT packed_ref AS packedRef FROM gallery_items WHERE gallery_id = ? AND item_key = ?`,
    [galleryId, itemKey]
  );
  const item = (rows as Array<{ packedRef: Buffer }>)[0];
  if (!item) {
    return false;
  }

  const { decodePackedRef } = await import("@onchain-gallery/shared");
  const { fetchEvmTokenUri, fetchEvmMetadataFallback } = await import("./alchemy");
  const { fetchTokenMetadata, normalizeMetadata, normalizeImageUrl } =
    await import("./metadata");

  const decoded = decodePackedRef(`0x${Buffer.from(item.packedRef).toString("hex")}`);
  if (decoded.kind !== "evm") {
    throw new Error("Metadata refresh only supported for EVM items");
  }

  let tokenUri: string | null = null;
  let metadata;
  try {
    tokenUri = await fetchEvmTokenUri(
      Number(decoded.chainId),
      decoded.contractAddress,
      decoded.tokenId.toString()
    );
    metadata = await fetchTokenMetadata(tokenUri);
  } catch (_err) {
    const fallback = await fetchEvmMetadataFallback(
      Number(decoded.chainId),
      decoded.contractAddress,
      decoded.tokenId.toString()
    );
    const raw = fallback.metadata || {};
    const normalized = normalizeMetadata(raw);
    const candidate = fallback.tokenUri?.raw || fallback.tokenUri?.gateway || null;
    if (
      typeof candidate === "string" &&
      (candidate.startsWith("http") ||
        candidate.startsWith("ipfs://") ||
        candidate.startsWith("ar://") ||
        candidate.startsWith("data:"))
    ) {
      tokenUri = candidate;
    } else {
      tokenUri = null;
    }
    metadata = {
      raw,
      imageUrl: normalizeImageUrl(
        normalized.imageUrl ||
          fallback.media?.[0]?.gateway ||
          fallback.media?.[0]?.raw ||
          null
      ),
      name: normalized.name || fallback.title || null,
      description: normalized.description || fallback.description || null,
    };
  }

  await pool.execute(
    `UPDATE gallery_items
     SET token_uri = ?, metadata_json = ?, image_url = ?, name = ?, description = ?
     WHERE gallery_id = ? AND item_key = ?`,
    [
      tokenUri,
      JSON.stringify(metadata.raw),
      metadata.imageUrl,
      metadata.name,
      metadata.description,
      galleryId,
      itemKey,
    ]
  );

  return true;
}

export async function fetchGalleryDetail(galleryId: number) {
  const pool = getPool();
  const [galleries] = await pool.execute(
    `SELECT gallery_id AS galleryId, owner_address AS owner, title, description,
            created_at AS createdAt, updated_at AS updatedAt
     FROM galleries WHERE gallery_id = ?`,
    [galleryId]
  );
  const gallery = (galleries as GallerySummary[])[0];

  const [items] = await pool.execute(
    `SELECT gallery_id AS galleryId, item_key AS itemKey, kind, packed_ref AS packedRef, added_at AS addedAt,
            removed_at AS removedAt, display_order AS displayOrder, label, note,
            token_uri AS tokenUri, metadata_json AS metadataJson, image_url AS imageUrl, name, description
     FROM gallery_items WHERE gallery_id = ? AND removed_at = 0
     ORDER BY COALESCE(display_order, added_at) ASC`,
    [galleryId]
  );

  const formattedItems = (items as Array<any>).map((item) => ({
    galleryId: item.galleryId,
    itemKey: item.itemKey,
    kind: item.kind,
    packedRefHex: `0x${Buffer.from(item.packedRef).toString("hex")}`,
    addedAt: item.addedAt,
    removedAt: item.removedAt,
    displayOrder: item.displayOrder,
    label: item.label,
    note: item.note,
    tokenUri: item.tokenUri,
    metadataJson:
      typeof item.metadataJson === "string"
        ? (() => {
            try {
              return JSON.parse(item.metadataJson);
            } catch (_err) {
              return item.metadataJson;
            }
          })()
        : item.metadataJson,
    imageUrl: item.imageUrl,
    name: item.name,
    description: item.description,
  }));

  return {
    gallery,
    items: formattedItems as GalleryItem[],
    notes: [] as GalleryNote[],
  };
}

export async function fetchFramePayload(galleryId: number) {
  const detail = await fetchGalleryDetail(galleryId);
  const galleryNote = detail.notes.find((note) => note.scope === 0);
  const itemNotes = detail.notes.filter((note) => note.scope === 1);

  return {
    gallery: detail.gallery,
    items: detail.items,
    galleryNote,
    itemNotes,
  };
}

export async function removeGalleryItem(galleryId: number, itemKey: string) {
  const pool = getPool();
  const now = Math.floor(Date.now() / 1000);
  const [result] = await pool.execute(
    `UPDATE gallery_items SET removed_at = ?
     WHERE gallery_id = ? AND item_key = ?`,
    [now, galleryId, itemKey]
  );
  const info = result as { affectedRows?: number };
  return (info.affectedRows ?? 0) > 0;
}
