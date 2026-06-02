CREATE TABLE IF NOT EXISTS indexed_collections (
  collection_address CHAR(42) PRIMARY KEY,
  creator_address CHAR(42) NOT NULL,
  name VARCHAR(255) NOT NULL,
  symbol VARCHAR(32) NOT NULL,
  created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS indexed_galleries (
  collection_address CHAR(42) NOT NULL,
  gallery_id BIGINT NOT NULL,
  owner_address CHAR(42) NOT NULL,
  title VARCHAR(255) NULL,
  description TEXT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (collection_address, gallery_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS indexed_gallery_items (
  collection_address CHAR(42) NOT NULL,
  gallery_id BIGINT NOT NULL,
  item_key CHAR(66) NOT NULL,
  packed_ref VARBINARY(128) NOT NULL,
  added_at BIGINT NOT NULL,
  removed_at BIGINT NOT NULL DEFAULT 0,
  display_order INT NULL,
  label VARCHAR(255) NULL,
  note TEXT NULL,
  PRIMARY KEY (collection_address, gallery_id, item_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
