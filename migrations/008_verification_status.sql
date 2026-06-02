ALTER TABLE indexed_collections
  ADD COLUMN verification_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  ADD COLUMN verification_provider VARCHAR(64) NULL,
  ADD COLUMN verified_at BIGINT NULL,
  ADD COLUMN verification_error TEXT NULL,
  ADD COLUMN verification_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN last_verification_attempt_at BIGINT NULL;
