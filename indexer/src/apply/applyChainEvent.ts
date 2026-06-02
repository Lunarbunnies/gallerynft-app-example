import { hexToBytes } from "@onchain-gallery/shared";
import { ChainEvent } from "../types";

type DbClient = {
  execute: (sql: string, params?: unknown[]) => Promise<[unknown, unknown?]>;
};

const isSqlite = (process.env.DB_DRIVER || "mysql").toLowerCase() === "sqlite";

function normalizeAddress(value: string) {
  return value.toLowerCase();
}

export async function applyChainEvent(pool: DbClient, event: ChainEvent) {
  if (event.type === "Checkpoint") return;

  if (event.type === "CollectionCreated") {
    if (isSqlite) {
      await pool.execute(
        `INSERT INTO indexed_collections
           (collection_address, creator_address, name, symbol, created_at, verification_status)
         VALUES (?, ?, ?, ?, ?, 'pending')
         ON CONFLICT(collection_address) DO UPDATE SET
           creator_address = excluded.creator_address,
           name = excluded.name,
           symbol = excluded.symbol,
           created_at = excluded.created_at`,
        [
          normalizeAddress(event.collectionAddress),
          normalizeAddress(event.creator),
          event.name,
          event.symbol,
          event.createdAt,
        ]
      );
      return;
    }
    await pool.execute(
      `INSERT INTO indexed_collections
         (collection_address, creator_address, name, symbol, created_at, verification_status)
       VALUES (?, ?, ?, ?, ?, 'pending')
       ON DUPLICATE KEY UPDATE
         creator_address = VALUES(creator_address),
         name = VALUES(name),
         symbol = VALUES(symbol),
         created_at = VALUES(created_at)`,
      [
        normalizeAddress(event.collectionAddress),
        normalizeAddress(event.creator),
        event.name,
        event.symbol,
        event.createdAt,
      ]
    );
    return;
  }

  if (event.type === "GalleryCreated") {
    if (isSqlite) {
      await pool.execute(
        `INSERT INTO indexed_galleries
           (collection_address, gallery_id, owner_address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(collection_address, gallery_id) DO UPDATE SET
           owner_address = excluded.owner_address`,
        [
          normalizeAddress(event.collectionAddress),
          event.galleryId,
          normalizeAddress(event.owner),
          event.createdAt,
          event.createdAt,
        ]
      );
      return;
    }
    await pool.execute(
      `INSERT INTO indexed_galleries
         (collection_address, gallery_id, owner_address, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE owner_address = VALUES(owner_address)`,
      [
        normalizeAddress(event.collectionAddress),
        event.galleryId,
        normalizeAddress(event.owner),
        event.createdAt,
        event.createdAt,
      ]
    );
    return;
  }

  if (event.type === "GalleryFieldsUpdated") {
    await pool.execute(
      `UPDATE indexed_galleries
       SET title = ?, description = ?, updated_at = ?
       WHERE collection_address = ? AND gallery_id = ?`,
      [
        event.title,
        event.description,
        event.updatedAt,
        normalizeAddress(event.collectionAddress),
        event.galleryId,
      ]
    );
    return;
  }

  if (event.type === "ItemAdded") {
    const packedRef = Buffer.from(hexToBytes(event.packedRefHex));
    if (isSqlite) {
      await pool.execute(
        `INSERT INTO indexed_gallery_items
           (collection_address, gallery_id, item_key, packed_ref, added_at, removed_at)
         VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(collection_address, gallery_id, item_key) DO UPDATE SET
           packed_ref = excluded.packed_ref,
           removed_at = 0`,
        [
          normalizeAddress(event.collectionAddress),
          event.galleryId,
          event.itemKey,
          packedRef,
          event.addedAt,
        ]
      );
      return;
    }
    await pool.execute(
      `INSERT INTO indexed_gallery_items
         (collection_address, gallery_id, item_key, packed_ref, added_at, removed_at)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE packed_ref = VALUES(packed_ref), removed_at = 0`,
      [
        normalizeAddress(event.collectionAddress),
        event.galleryId,
        event.itemKey,
        packedRef,
        event.addedAt,
      ]
    );
    return;
  }

  if (event.type === "ItemFieldsUpdated") {
    await pool.execute(
      `UPDATE indexed_gallery_items
       SET display_order = ?, label = ?, note = ?
       WHERE collection_address = ? AND gallery_id = ? AND item_key = ?`,
      [
        event.displayOrder,
        event.label,
        event.note,
        normalizeAddress(event.collectionAddress),
        event.galleryId,
        event.itemKey,
      ]
    );
    return;
  }

  if (event.type === "ItemRemoved") {
    await pool.execute(
      `UPDATE indexed_gallery_items
       SET removed_at = ?
       WHERE collection_address = ? AND gallery_id = ? AND item_key = ?`,
      [
        event.removedAt,
        normalizeAddress(event.collectionAddress),
        event.galleryId,
        event.itemKey,
      ]
    );
  }
}
