CREATE TABLE IF NOT EXISTS indexed_item_metadata (
  collection_address TEXT NOT NULL,
  gallery_id INTEGER NOT NULL,
  item_key TEXT NOT NULL,
  token_uri TEXT NULL,
  metadata_json TEXT NULL,
  image_url TEXT NULL,
  animation_url TEXT NULL,
  animation_mime TEXT NULL,
  name TEXT NULL,
  description TEXT NULL,
  artist TEXT NULL,
  fetched_at INTEGER NOT NULL,
  fetch_error TEXT NULL,
  PRIMARY KEY (collection_address, gallery_id, item_key)
);
