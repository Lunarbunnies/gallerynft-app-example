ALTER TABLE indexed_collections ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE indexed_collections ADD COLUMN verification_provider TEXT NULL;
ALTER TABLE indexed_collections ADD COLUMN verified_at INTEGER NULL;
ALTER TABLE indexed_collections ADD COLUMN verification_error TEXT NULL;
ALTER TABLE indexed_collections ADD COLUMN verification_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE indexed_collections ADD COLUMN last_verification_attempt_at INTEGER NULL;
