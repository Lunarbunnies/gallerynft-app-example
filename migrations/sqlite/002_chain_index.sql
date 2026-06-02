CREATE TABLE IF NOT EXISTS indexed_collections (
  collection_address TEXT PRIMARY KEY,
  creator_address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS indexed_galleries (
  collection_address TEXT NOT NULL,
  gallery_id INTEGER NOT NULL,
  owner_address TEXT NOT NULL,
  title TEXT NULL,
  description TEXT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (collection_address, gallery_id)
);

CREATE TABLE IF NOT EXISTS indexed_gallery_items (
  collection_address TEXT NOT NULL,
  gallery_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  packed_ref BLOB NOT NULL,
  added_at INTEGER NOT NULL,
  removed_at INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NULL,
  label TEXT NULL,
  note TEXT NULL,
  PRIMARY KEY (collection_address, gallery_id, item_key)
);
