type DbClient = {
  execute: (sql: string, params?: unknown[]) => Promise<[unknown, unknown?]>;
};
const isSqlite = (process.env.DB_DRIVER || "mysql").toLowerCase() === "sqlite";

export async function upsertGallery(
  pool: DbClient,
  galleryId: number,
  owner: string,
  createdAt: number
) {
  if (isSqlite) {
    await pool.execute(
      `INSERT INTO galleries (gallery_id, owner_address, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(gallery_id) DO UPDATE SET owner_address = excluded.owner_address`,
      [galleryId, owner, createdAt, createdAt]
    );
    return;
  }
  await pool.execute(
    `INSERT INTO galleries (gallery_id, owner_address, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE owner_address = VALUES(owner_address)`,
    [galleryId, owner, createdAt, createdAt]
  );
}

export async function upsertItem(
  pool: DbClient,
  galleryId: number,
  itemKey: string,
  kind: number,
  packedRef: Buffer,
  addedAt: number
) {
  if (isSqlite) {
    await pool.execute(
      `INSERT INTO gallery_items (gallery_id, item_key, kind, packed_ref, added_at, removed_at)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(gallery_id, item_key) DO UPDATE SET
         kind = excluded.kind,
         packed_ref = excluded.packed_ref,
         removed_at = 0`,
      [galleryId, itemKey, kind, packedRef, addedAt]
    );
    return;
  }
  await pool.execute(
    `INSERT INTO gallery_items (gallery_id, item_key, kind, packed_ref, added_at, removed_at)
     VALUES (?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE kind = VALUES(kind), packed_ref = VALUES(packed_ref), removed_at = 0`,
    [galleryId, itemKey, kind, packedRef, addedAt]
  );
}

export async function removeItem(
  pool: DbClient,
  galleryId: number,
  itemKey: string,
  removedAt: number
) {
  await pool.execute(
    `UPDATE gallery_items SET removed_at = ? WHERE gallery_id = ? AND item_key = ?`,
    [removedAt, galleryId, itemKey]
  );
}

export async function upsertNote(
  pool: DbClient,
  galleryId: number,
  scope: number,
  targetKey: string,
  noteText: string
) {
  const now = Math.floor(Date.now() / 1000);
  if (isSqlite) {
    await pool.execute(
      `INSERT INTO gallery_notes (gallery_id, scope, target_key, note_text, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(gallery_id, scope, target_key) DO UPDATE SET
         note_text = excluded.note_text,
         updated_at = excluded.updated_at`,
      [galleryId, scope, targetKey, noteText, now]
    );
    return;
  }
  await pool.execute(
    `INSERT INTO gallery_notes (gallery_id, scope, target_key, note_text, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE note_text = VALUES(note_text), updated_at = VALUES(updated_at)`,
    [galleryId, scope, targetKey, noteText, now]
  );
}

export async function updateGalleryFields(
  pool: DbClient,
  galleryId: number,
  title: string,
  description: string,
  updatedAt: number
) {
  await pool.execute(
    `UPDATE galleries SET title = ?, description = ?, updated_at = ? WHERE gallery_id = ?`,
    [title, description, updatedAt, galleryId]
  );
}

export async function updateItemFields(
  pool: DbClient,
  galleryId: number,
  itemKey: string,
  displayOrder: number | null,
  label: string,
  note: string
) {
  await pool.execute(
    `UPDATE gallery_items
     SET display_order = ?, label = ?, note = ?
     WHERE gallery_id = ? AND item_key = ?`,
    [displayOrder, label, note, galleryId, itemKey]
  );
}

export async function getCheckpoint(pool: DbClient, sourceName: string) {
  const [rows] = await pool.execute(
    `SELECT last_event_id FROM indexer_checkpoints WHERE source_name = ?`,
    [sourceName]
  );
  const data = rows as Array<{ last_event_id: number }>;
  if (data.length === 0) {
    return 0;
  }
  return data[0].last_event_id;
}

export async function upsertCheckpoint(
  pool: DbClient,
  sourceName: string,
  lastEventId: number
) {
  const now = Math.floor(Date.now() / 1000);
  if (isSqlite) {
    await pool.execute(
      `INSERT INTO indexer_checkpoints (source_name, last_event_id, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(source_name) DO UPDATE SET
         last_event_id = excluded.last_event_id,
         updated_at = excluded.updated_at`,
      [sourceName, lastEventId, now]
    );
    return;
  }
  await pool.execute(
    `INSERT INTO indexer_checkpoints (source_name, last_event_id, updated_at)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE last_event_id = VALUES(last_event_id), updated_at = VALUES(updated_at)`,
    [sourceName, lastEventId, now]
  );
}
