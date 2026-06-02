CREATE TABLE IF NOT EXISTS indexed_item_metadata (
  collection_address CHAR(42) NOT NULL,
  gallery_id BIGINT NOT NULL,
  item_key CHAR(66) NOT NULL,
  token_uri LONGTEXT NULL,
  metadata_json JSON NULL,
  image_url LONGTEXT NULL,
  animation_url LONGTEXT NULL,
  animation_mime VARCHAR(128) NULL,
  name VARCHAR(255) NULL,
  description TEXT NULL,
  artist VARCHAR(255) NULL,
  fetched_at BIGINT NOT NULL,
  fetch_error TEXT NULL,
  PRIMARY KEY (collection_address, gallery_id, item_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
