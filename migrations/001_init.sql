CREATE TABLE IF NOT EXISTS chains (
  chain_id BIGINT PRIMARY KEY,
  name VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS galleries (
  gallery_id BIGINT PRIMARY KEY,
  owner_address CHAR(42) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gallery_items (
  gallery_id BIGINT NOT NULL,
  item_key CHAR(66) NOT NULL,
  kind SMALLINT NOT NULL,
  packed_ref VARBINARY(64) NOT NULL,
  added_at DATETIME NOT NULL,
  removed_at DATETIME NULL,
  PRIMARY KEY (gallery_id, item_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gallery_notes (
  gallery_id BIGINT NOT NULL,
  scope SMALLINT NOT NULL,
  target_key CHAR(66) NOT NULL,
  note_text TEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (gallery_id, scope, target_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS indexer_checkpoints (
  source_name VARCHAR(64) PRIMARY KEY,
  last_event_id BIGINT NOT NULL,
  updated_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
