import { getPool } from "./db";
import { decodePackedRef, hashBytes20ToKt1 } from "@onchain-gallery/shared";
import { Contract, JsonRpcProvider } from "ethers";
import { fetchEvmMetadataFallback, fetchEvmTokenUri } from "./alchemy";
import {
  fetchTokenMetadata,
  fetchTezosTokenMetadata,
  normalizeImageUrl,
  normalizeMetadata,
} from "./metadata";

const COLLECTION_METADATA_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
] as const;

export type IndexedCollection = {
  collectionAddress: string;
  creatorAddress: string;
  name: string;
  symbol: string;
  createdAt: number;
};

export type IndexedGallery = {
  collectionAddress: string;
  galleryId: number;
  owner: string;
  title: string | null;
  description: string | null;
  createdAt: number;
  updatedAt: number;
  itemCount: number;
};

export type IndexedGalleryItem = {
  collectionAddress: string;
  galleryId: number;
  itemKey: string;
  packedRefHex: string;
  addedAt: number;
  removedAt: number;
  displayOrder: number | null;
  label: string | null;
  note: string | null;
  tokenUri?: string | null;
  metadataJson?: unknown | null;
  imageUrl?: string | null;
  animationUrl?: string | null;
  animationMime?: string | null;
  name?: string | null;
  description?: string | null;
  artist?: string | null;
  fetchedAt?: number | null;
  fetchError?: string | null;
};

export async function fetchIndexedDashboard(owner?: string | null) {
  const pool = getPool();
  const params: unknown[] = [];
  const ownerWhere = owner ? "WHERE LOWER(owner_address) = LOWER(?)" : "";
  if (owner) params.push(owner);

  const [collections] = await pool.execute(
    `SELECT collection_address AS collectionAddress,
            creator_address AS creatorAddress,
            name,
            symbol,
            created_at AS createdAt
     FROM indexed_collections
     ORDER BY created_at DESC`
  );

  const [galleries] = await pool.execute(
    `SELECT g.collection_address AS collectionAddress,
            g.gallery_id AS galleryId,
            g.owner_address AS owner,
            g.title,
            g.description,
            g.created_at AS createdAt,
            g.updated_at AS updatedAt,
            COUNT(i.item_key) AS itemCount
     FROM indexed_galleries g
     LEFT JOIN indexed_gallery_items i
       ON i.collection_address = g.collection_address
      AND i.gallery_id = g.gallery_id
      AND i.removed_at = 0
     ${ownerWhere}
     GROUP BY g.collection_address, g.gallery_id, g.owner_address, g.title, g.description, g.created_at, g.updated_at
     ORDER BY g.updated_at DESC`,
    params
  );

  return {
    collections: await hydratePlaceholderCollections(collections as IndexedCollection[]),
    galleries: galleries as IndexedGallery[],
  };
}

async function hydratePlaceholderCollections(collections: IndexedCollection[]) {
  const rpcUrl =
    process.env.INDEXER_RPC_URL ||
    process.env.SEPOLIA_RPC_URL ||
    process.env.MAINNET_RPC_URL;
  const placeholders = collections.filter(
    (collection) => collection.name === "Imported GalleryNFT" && collection.symbol === "GALLERY"
  );
  if (!rpcUrl || placeholders.length === 0) return collections;

  const provider = new JsonRpcProvider(rpcUrl);
  const pool = getPool();
  return Promise.all(
    collections.map(async (collection) => {
      if (collection.name !== "Imported GalleryNFT" || collection.symbol !== "GALLERY") {
        return collection;
      }
      try {
        const contract = new Contract(collection.collectionAddress, COLLECTION_METADATA_ABI, provider);
        const [name, symbol] = await Promise.all([contract.name(), contract.symbol()]);
        const hydrated = { ...collection, name: String(name), symbol: String(symbol) };
        await pool.execute(
          `UPDATE indexed_collections SET name = ?, symbol = ? WHERE LOWER(collection_address) = LOWER(?)`,
          [hydrated.name, hydrated.symbol, collection.collectionAddress]
        );
        return hydrated;
      } catch (_err) {
        return collection;
      }
    })
  );
}

export async function fetchIndexedGallery(collectionAddress: string, galleryId: number) {
  const pool = getPool();
  const [galleries] = await pool.execute(
    `SELECT collection_address AS collectionAddress,
            gallery_id AS galleryId,
            owner_address AS owner,
            title,
            description,
            created_at AS createdAt,
            updated_at AS updatedAt
     FROM indexed_galleries
     WHERE LOWER(collection_address) = LOWER(?) AND gallery_id = ?`,
    [collectionAddress, galleryId]
  );
  const gallery = (galleries as IndexedGallery[])[0] || null;

  const [items] = await pool.execute(
    `SELECT i.collection_address AS collectionAddress,
            i.gallery_id AS galleryId,
            i.item_key AS itemKey,
            i.packed_ref AS packedRef,
            i.added_at AS addedAt,
            i.removed_at AS removedAt,
            i.display_order AS displayOrder,
            i.label,
            i.note,
            m.token_uri AS tokenUri,
            m.metadata_json AS metadataJson,
            m.image_url AS imageUrl,
            m.animation_url AS animationUrl,
            m.animation_mime AS animationMime,
            m.name,
            m.description,
            m.artist,
            m.fetched_at AS fetchedAt,
            m.fetch_error AS fetchError
     FROM indexed_gallery_items i
     LEFT JOIN indexed_item_metadata m
       ON m.collection_address = i.collection_address
      AND m.gallery_id = i.gallery_id
      AND m.item_key = i.item_key
     WHERE LOWER(i.collection_address) = LOWER(?)
       AND i.gallery_id = ?
       AND i.removed_at = 0
     ORDER BY COALESCE(i.display_order, i.added_at) ASC`,
    [collectionAddress, galleryId]
  );

  return {
    gallery,
    items: (items as Array<any>).map((item) => ({
      collectionAddress: item.collectionAddress,
      galleryId: item.galleryId,
      itemKey: item.itemKey,
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
      animationUrl: item.animationUrl,
      animationMime: item.animationMime,
      name: item.name,
      description: item.description,
      artist: item.artist,
      fetchedAt: item.fetchedAt,
      fetchError: item.fetchError,
    })) as IndexedGalleryItem[],
  };
}

export async function refreshIndexedGalleryMetadata(collectionAddress: string, galleryId: number) {
  const pool = getPool();
  const detail = await fetchIndexedGallery(collectionAddress, galleryId);
  const now = Math.floor(Date.now() / 1000);
  let refreshed = 0;

  for (const item of detail.items) {
    try {
      const decoded = decodePackedRef(item.packedRefHex);
      let tokenUri: string | null = null;
      let raw: unknown = null;
      let imageUrl: string | null = null;
      let animationUrl: string | null = null;
      let animationMime: string | null = null;
      let name: string | null = null;
      let description: string | null = null;
      let artist: string | null = null;

      if (decoded.kind === "tezos") {
        const contractAddress = hashBytes20ToKt1(decoded.contractHash);
        const metadata = await fetchTezosTokenMetadata(contractAddress, decoded.tokenId.toString());
        raw = metadata.raw;
        imageUrl = metadata.imageUrl;
        animationUrl = metadata.animationUrl;
        animationMime = metadata.animationMime;
        name = metadata.name;
        description = metadata.description;
        artist = metadata.artist;
      } else {
        try {
          tokenUri = await fetchEvmTokenUri(
            Number(decoded.chainId),
            decoded.contractAddress,
            decoded.tokenId.toString()
          );
          const metadata = await fetchTokenMetadata(tokenUri);
          raw = metadata.raw;
          imageUrl = metadata.imageUrl;
          animationUrl = metadata.animationUrl;
          animationMime = metadata.animationMime;
          name = metadata.name;
          description = metadata.description;
          artist = metadata.artist;
        } catch (_err) {
          const fallback = await fetchEvmMetadataFallback(
            Number(decoded.chainId),
            decoded.contractAddress,
            decoded.tokenId.toString()
          );
          raw = fallback.metadata || {};
          const normalized = normalizeMetadata(raw as any);
          imageUrl = normalizeImageUrl(
            normalized.imageUrl ||
              fallback.media?.[0]?.gateway ||
              fallback.media?.[0]?.raw ||
              null
          );
          animationUrl = normalized.animationUrl || fallback.rawMetadata?.animation_url || null;
          animationMime = normalized.animationMime || null;
          name = normalized.name || fallback.title || null;
          description = normalized.description || fallback.description || null;
          artist = normalized.artist || null;
          const candidate = fallback.tokenUri?.raw || fallback.tokenUri?.gateway || null;
          tokenUri =
            typeof candidate === "string" &&
            (candidate.startsWith("http") ||
              candidate.startsWith("ipfs://") ||
              candidate.startsWith("ar://") ||
              candidate.startsWith("data:"))
              ? candidate
              : null;
        }
      }

      await upsertIndexedMetadata(pool, {
        collectionAddress,
        galleryId,
        itemKey: item.itemKey,
        tokenUri,
        metadataJson: raw ? JSON.stringify(raw) : null,
        imageUrl,
        animationUrl,
        animationMime,
        name,
        description,
        artist,
        fetchedAt: now,
        fetchError: null,
      });
      refreshed += 1;
    } catch (err) {
      await upsertIndexedMetadata(pool, {
        collectionAddress,
        galleryId,
        itemKey: item.itemKey,
        tokenUri: null,
        metadataJson: null,
        imageUrl: null,
        animationUrl: null,
        animationMime: null,
        name: null,
        description: null,
        artist: null,
        fetchedAt: now,
        fetchError: err instanceof Error ? err.message : "Metadata refresh failed",
      });
    }
  }

  return { refreshed, total: detail.items.length };
}

async function upsertIndexedMetadata(
  pool: ReturnType<typeof getPool>,
  data: {
    collectionAddress: string;
    galleryId: number;
    itemKey: string;
    tokenUri: string | null;
    metadataJson: string | null;
    imageUrl: string | null;
    animationUrl: string | null;
    animationMime: string | null;
    name: string | null;
    description: string | null;
    artist: string | null;
    fetchedAt: number;
    fetchError: string | null;
  }
) {
  const isSqlite = (process.env.DB_DRIVER || "mysql").toLowerCase() === "sqlite";
  const params = [
    data.collectionAddress.toLowerCase(),
    data.galleryId,
    data.itemKey,
    data.tokenUri,
    data.metadataJson,
    data.imageUrl,
    data.animationUrl,
    data.animationMime,
    data.name,
    data.description,
    data.artist,
    data.fetchedAt,
    data.fetchError,
  ];

  if (isSqlite) {
    await pool.execute(
      `INSERT INTO indexed_item_metadata
         (collection_address, gallery_id, item_key, token_uri, metadata_json, image_url,
          animation_url, animation_mime, name, description, artist, fetched_at, fetch_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(collection_address, gallery_id, item_key) DO UPDATE SET
         token_uri = excluded.token_uri,
         metadata_json = excluded.metadata_json,
         image_url = excluded.image_url,
         animation_url = excluded.animation_url,
         animation_mime = excluded.animation_mime,
         name = excluded.name,
         description = excluded.description,
         artist = excluded.artist,
         fetched_at = excluded.fetched_at,
         fetch_error = excluded.fetch_error`,
      params
    );
    return;
  }

  await pool.execute(
    `INSERT INTO indexed_item_metadata
       (collection_address, gallery_id, item_key, token_uri, metadata_json, image_url,
        animation_url, animation_mime, name, description, artist, fetched_at, fetch_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       token_uri = VALUES(token_uri),
       metadata_json = VALUES(metadata_json),
       image_url = VALUES(image_url),
       animation_url = VALUES(animation_url),
       animation_mime = VALUES(animation_mime),
       name = VALUES(name),
       description = VALUES(description),
       artist = VALUES(artist),
       fetched_at = VALUES(fetched_at),
       fetch_error = VALUES(fetch_error)`,
    params
  );
}
