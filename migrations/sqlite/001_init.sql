CREATE TABLE IF NOT EXISTS chains (
  chain_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS galleries (
  gallery_id INTEGER PRIMARY KEY,
  owner_address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  title TEXT NULL,
  description TEXT NULL
);

CREATE TABLE IF NOT EXISTS gallery_items (
  gallery_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  kind INTEGER NOT NULL,
  packed_ref BLOB NOT NULL,
  added_at INTEGER NOT NULL,
  removed_at INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NULL,
  label TEXT NULL,
  note TEXT NULL,
  token_uri TEXT NULL,
  metadata_json TEXT NULL,
  image_url TEXT NULL,
  name TEXT NULL,
  description TEXT NULL,
  PRIMARY KEY (gallery_id, item_key)
);

CREATE TABLE IF NOT EXISTS gallery_notes (
  gallery_id INTEGER NOT NULL,
  scope INTEGER NOT NULL,
  target_key TEXT NOT NULL,
  note_text TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (gallery_id, scope, target_key)
);

CREATE TABLE IF NOT EXISTS indexer_checkpoints (
  source_name TEXT PRIMARY KEY,
  last_event_id INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
