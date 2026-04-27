ALTER TABLE gallery_items
  ADD COLUMN token_uri TEXT NULL,
  ADD COLUMN metadata_json JSON NULL,
  ADD COLUMN image_url TEXT NULL,
  ADD COLUMN name VARCHAR(255) NULL,
  ADD COLUMN description TEXT NULL;
