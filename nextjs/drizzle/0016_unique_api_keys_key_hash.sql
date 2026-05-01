-- Preflight: duplicate key_hash rows must be resolved manually before adding
-- the unique index. API key plaintext cannot be recovered, so deleting rows in
-- a migration would silently revoke access and discard key metadata.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM api_keys
    GROUP BY key_hash
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create api_keys.key_hash unique index: duplicate key_hash rows exist. Run SELECT key_hash, COUNT(*) FROM api_keys GROUP BY key_hash HAVING COUNT(*) > 1; and resolve manually before deploying.';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_unique" ON "api_keys" USING btree ("key_hash");
