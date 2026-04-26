-- Defensive dedupe: if any duplicate key_hash rows exist (collision or buggy
-- migration), keep the oldest row per key_hash and remove the rest. The
-- unique index below would otherwise fail to build.
DELETE FROM api_keys a1
USING api_keys a2
WHERE a1.key_hash = a2.key_hash
  AND a1.created_at > a2.created_at;
--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_unique" ON "api_keys" USING btree ("key_hash");
