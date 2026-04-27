ALTER TABLE galleries
  ADD COLUMN created_at_ts BIGINT NULL,
  ADD COLUMN updated_at_ts BIGINT NULL;

UPDATE galleries
SET created_at_ts = CASE
  WHEN CAST(created_at AS CHAR) LIKE '%-%' THEN UNIX_TIMESTAMP(created_at)
  ELSE created_at
END,
updated_at_ts = CASE
  WHEN CAST(updated_at AS CHAR) LIKE '%-%' THEN UNIX_TIMESTAMP(updated_at)
  ELSE updated_at
END;

ALTER TABLE galleries
  DROP COLUMN created_at,
  DROP COLUMN updated_at,
  CHANGE COLUMN created_at_ts created_at BIGINT NOT NULL,
  CHANGE COLUMN updated_at_ts updated_at BIGINT NOT NULL,
  ADD COLUMN title VARCHAR(255) NULL,
  ADD COLUMN description TEXT NULL;

ALTER TABLE gallery_items
  ADD COLUMN added_at_ts BIGINT NULL,
  ADD COLUMN removed_at_ts BIGINT NULL,
  ADD COLUMN display_order INT NULL,
  ADD COLUMN label VARCHAR(255) NULL,
  ADD COLUMN note TEXT NULL;

UPDATE gallery_items
SET added_at_ts = CASE
  WHEN CAST(added_at AS CHAR) LIKE '%-%' THEN UNIX_TIMESTAMP(added_at)
  ELSE added_at
END,
removed_at_ts = CASE
  WHEN removed_at IS NULL THEN 0
  WHEN CAST(removed_at AS CHAR) LIKE '%-%' THEN UNIX_TIMESTAMP(removed_at)
  ELSE removed_at
END;

ALTER TABLE gallery_items
  DROP COLUMN added_at,
  DROP COLUMN removed_at,
  CHANGE COLUMN added_at_ts added_at BIGINT NOT NULL,
  CHANGE COLUMN removed_at_ts removed_at BIGINT NOT NULL DEFAULT 0;
