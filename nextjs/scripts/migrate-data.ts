/**
 * One-time data migration script: Supabase → PlanetScale Postgres
 *
 * Usage:
 *   cd nextjs
 *   npx tsx scripts/migrate-data.ts --supabase-url="postgres://postgres.[ref]:[password]@[host]:5432/postgres"
 *
 * Requires DATABASE_URL in .env.local for the target PlanetScale database.
 */

import { config } from "dotenv";
import postgres from "postgres";

// Load .env.local (Next.js convention)
config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const supabaseUrl = process.argv
  .find((a) => a.startsWith("--supabase-url="))
  ?.split("=")
  .slice(1)
  .join("=");

if (!supabaseUrl) {
  console.error(
    "Usage: npx tsx scripts/migrate-data.ts --supabase-url=postgres://..."
  );
  process.exit(1);
}

const targetUrl = process.env.DATABASE_URL;
if (!targetUrl) {
  console.error("DATABASE_URL not found — add it to .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

const source = postgres(supabaseUrl, { max: 5 });
const target = postgres(targetUrl, { max: 5 });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100;

async function batchInsert(
  sql: postgres.Sql,
  table: string,
  columns: string[],
  rows: Record<string, unknown>[]
) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const colList = columns.map((c) => `"${c}"`).join(", ");
    const valuePlaceholders = batch
      .map(
        (_, rowIdx) =>
          `(${columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`).join(", ")})`
      )
      .join(", ");

    const values = batch.flatMap((row) => columns.map((c) => row[c] ?? null));

    await sql.unsafe(
      `INSERT INTO "${table}" (${colList}) VALUES ${valuePlaceholders} ON CONFLICT DO NOTHING`,
      values
    );
  }
}

async function countRows(
  sql: postgres.Sql,
  table: string,
  schema = "public"
): Promise<number> {
  const [row] = await sql.unsafe(
    `SELECT count(*)::int AS cnt FROM "${schema}"."${table}"`
  );
  return row.cnt;
}

function log(msg: string) {
  console.log(`[migrate] ${msg}`);
}

// ---------------------------------------------------------------------------
// Triggers to disable/re-enable on target
// ---------------------------------------------------------------------------

const TRIGGERS = [
  { table: "youtube_channels", trigger: "update_youtube_channels_updated_at" },
  { table: "containers", trigger: "update_containers_updated_at" },
  { table: "templates", trigger: "update_templates_updated_at" },
  { table: "youtube_videos", trigger: "update_youtube_videos_updated_at" },
  { table: "video_variables", trigger: "update_video_variables_updated_at" },
  { table: "subscriptions", trigger: "update_subscriptions_updated_at" },
  {
    table: "youtube_videos",
    trigger: "prevent_video_container_reassignment",
  },
  {
    table: "description_history",
    trigger: "set_description_history_version",
  },
];

async function disableTriggers() {
  for (const { table, trigger } of TRIGGERS) {
    await target.unsafe(
      `ALTER TABLE "${table}" DISABLE TRIGGER "${trigger}"`
    );
  }
  log("Disabled triggers on target");
}

async function enableTriggers() {
  for (const { table, trigger } of TRIGGERS) {
    await target.unsafe(
      `ALTER TABLE "${table}" ENABLE TRIGGER "${trigger}"`
    );
  }
  log("Re-enabled triggers on target");
}

// ---------------------------------------------------------------------------
// Migration steps
// ---------------------------------------------------------------------------

async function migrateUsers() {
  const existing = await countRows(target, "user");
  if (existing > 0) {
    log(`Skipping "user" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT
      id,
      COALESCE(raw_user_meta_data->>'full_name', 'User') AS name,
      email,
      CASE WHEN email_confirmed_at IS NOT NULL THEN true ELSE false END AS email_verified,
      raw_user_meta_data->>'avatar_url' AS image,
      created_at,
      updated_at
    FROM auth.users
  `);

  log(`Migrating ${rows.length} users…`);
  await batchInsert(target, "user", [
    "id",
    "name",
    "email",
    "email_verified",
    "image",
    "created_at",
    "updated_at",
  ], rows as Record<string, unknown>[]);
}

async function migrateAccounts() {
  const existing = await countRows(target, "account");
  if (existing > 0) {
    log(`Skipping "account" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT
      gen_random_uuid() AS id,
      user_id,
      identity_data->>'sub' AS account_id,
      'google' AS provider_id,
      created_at,
      updated_at
    FROM auth.identities
    WHERE provider = 'google'
  `);

  log(`Migrating ${rows.length} accounts (Google OAuth)…`);
  await batchInsert(target, "account", [
    "id",
    "user_id",
    "account_id",
    "provider_id",
    "created_at",
    "updated_at",
  ], rows as Record<string, unknown>[]);
}

async function migrateYoutubeChannels() {
  const existing = await countRows(target, "youtube_channels");
  if (existing > 0) {
    log(`Skipping "youtube_channels" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT id, user_id, channel_id, title, thumbnail_url, subscriber_count,
           access_token_encrypted, refresh_token_encrypted, token_expires_at,
           token_status, sync_status, last_synced_at, created_at, updated_at
    FROM public.youtube_channels
  `);

  log(`Migrating ${rows.length} youtube_channels…`);
  await batchInsert(target, "youtube_channels", [
    "id", "user_id", "channel_id", "title", "thumbnail_url", "subscriber_count",
    "access_token_encrypted", "refresh_token_encrypted", "token_expires_at",
    "token_status", "sync_status", "last_synced_at", "created_at", "updated_at",
  ], rows as Record<string, unknown>[]);
}

async function migrateContainers() {
  const existing = await countRows(target, "containers");
  if (existing > 0) {
    log(`Skipping "containers" — already has ${existing} rows`);
    return;
  }

  // Convert uuid[] → jsonb (text[] intermediary)
  const rows = await source.unsafe(`
    SELECT id, user_id, name, separator,
           template_order::text[] AS template_order_arr,
           created_at, updated_at
    FROM public.containers
  `);

  const mapped = rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    separator: r.separator,
    template_order: r.template_order_arr
      ? JSON.stringify(r.template_order_arr)
      : null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  log(`Migrating ${mapped.length} containers…`);
  await batchInsert(target, "containers", [
    "id", "user_id", "name", "separator", "template_order",
    "created_at", "updated_at",
  ], mapped);
}

async function migrateTemplates() {
  const existing = await countRows(target, "templates");
  if (existing > 0) {
    log(`Skipping "templates" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT id, user_id, name, content, created_at, updated_at
    FROM public.templates
  `);

  log(`Migrating ${rows.length} templates…`);
  await batchInsert(target, "templates", [
    "id", "user_id", "name", "content", "created_at", "updated_at",
  ], rows as Record<string, unknown>[]);
}

async function migrateYoutubeVideos() {
  const existing = await countRows(target, "youtube_videos");
  if (existing > 0) {
    log(`Skipping "youtube_videos" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT id, channel_id, video_id, title, current_description,
           container_id, published_at, created_at, updated_at
    FROM public.youtube_videos
  `);

  log(`Migrating ${rows.length} youtube_videos…`);
  await batchInsert(target, "youtube_videos", [
    "id", "channel_id", "video_id", "title", "current_description",
    "container_id", "published_at", "created_at", "updated_at",
  ], rows as Record<string, unknown>[]);
}

async function migrateVideoVariables() {
  const existing = await countRows(target, "video_variables");
  if (existing > 0) {
    log(`Skipping "video_variables" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT id, video_id, template_id, variable_name, variable_value,
           created_at, updated_at
    FROM public.video_variables
  `);

  log(`Migrating ${rows.length} video_variables…`);
  await batchInsert(target, "video_variables", [
    "id", "video_id", "template_id", "variable_name", "variable_value",
    "created_at", "updated_at",
  ], rows as Record<string, unknown>[]);
}

async function migrateDescriptionHistory() {
  const existing = await countRows(target, "description_history");
  if (existing > 0) {
    log(`Skipping "description_history" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT id, video_id, description, version_number, created_by, created_at
    FROM public.description_history
  `);

  log(`Migrating ${rows.length} description_history…`);
  await batchInsert(target, "description_history", [
    "id", "video_id", "description", "version_number", "created_by", "created_at",
  ], rows as Record<string, unknown>[]);
}

async function migrateSubscriptions() {
  const existing = await countRows(target, "subscriptions");
  if (existing > 0) {
    log(`Skipping "subscriptions" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT id, user_id, stripe_subscription_id, stripe_customer_id,
           stripe_checkout_session_id, plan_tier, status,
           current_period_start, current_period_end,
           cancel_at_period_end, created_at, updated_at
    FROM public.subscriptions
  `);

  log(`Migrating ${rows.length} subscriptions…`);
  await batchInsert(target, "subscriptions", [
    "id", "user_id", "stripe_subscription_id", "stripe_customer_id",
    "stripe_checkout_session_id", "plan_tier", "status",
    "current_period_start", "current_period_end",
    "cancel_at_period_end", "created_at", "updated_at",
  ], rows as Record<string, unknown>[]);
}

async function migrateWebhookEvents() {
  const existing = await countRows(target, "webhook_events");
  if (existing > 0) {
    log(`Skipping "webhook_events" — already has ${existing} rows`);
    return;
  }

  const rows = await source.unsafe(`
    SELECT id, event_id, event_type, payload, processed,
           processed_at, error_message, created_at
    FROM public.webhook_events
  `);

  log(`Migrating ${rows.length} webhook_events…`);
  await batchInsert(target, "webhook_events", [
    "id", "event_id", "event_type", "payload", "processed",
    "processed_at", "error_message", "created_at",
  ], rows as Record<string, unknown>[]);
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

interface TableCheck {
  name: string;
  sourceTable: string;
  sourceSchema: string;
  targetTable: string;
}

const TABLE_CHECKS: TableCheck[] = [
  { name: "user", sourceTable: "users", sourceSchema: "auth", targetTable: "user" },
  { name: "account", sourceTable: "identities", sourceSchema: "auth", targetTable: "account" },
  { name: "youtube_channels", sourceTable: "youtube_channels", sourceSchema: "public", targetTable: "youtube_channels" },
  { name: "containers", sourceTable: "containers", sourceSchema: "public", targetTable: "containers" },
  { name: "templates", sourceTable: "templates", sourceSchema: "public", targetTable: "templates" },
  { name: "youtube_videos", sourceTable: "youtube_videos", sourceSchema: "public", targetTable: "youtube_videos" },
  { name: "video_variables", sourceTable: "video_variables", sourceSchema: "public", targetTable: "video_variables" },
  { name: "description_history", sourceTable: "description_history", sourceSchema: "public", targetTable: "description_history" },
  { name: "subscriptions", sourceTable: "subscriptions", sourceSchema: "public", targetTable: "subscriptions" },
  { name: "webhook_events", sourceTable: "webhook_events", sourceSchema: "public", targetTable: "webhook_events" },
];

async function verify() {
  log("\n=== Verification ===");
  let allPassed = true;

  for (const check of TABLE_CHECKS) {
    let sourceCount: number;
    // For account, only count google identities since we only migrate those
    if (check.name === "account") {
      const [row] = await source.unsafe(
        `SELECT count(*)::int AS cnt FROM auth.identities WHERE provider = 'google'`
      );
      sourceCount = row.cnt;
    } else {
      sourceCount = await countRows(source, check.sourceTable, check.sourceSchema);
    }

    const targetCount = await countRows(target, check.targetTable);
    const match = sourceCount === targetCount;
    const status = match ? "PASS" : "FAIL";
    if (!match) allPassed = false;

    console.log(
      `  [${status}] ${check.name.padEnd(22)} source=${sourceCount}  target=${targetCount}`
    );
  }

  return allPassed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log("Starting data migration: Supabase → PlanetScale");
  log(`Source: ${supabaseUrl.replace(/:[^@]*@/, ":***@")}`);
  log(`Target: ${targetUrl.replace(/:[^@]*@/, ":***@")}`);

  // Test connections
  try {
    await source.unsafe("SELECT 1");
    log("Source connection OK");
  } catch (e) {
    console.error("Failed to connect to source (Supabase):", e);
    process.exit(1);
  }

  try {
    await target.unsafe("SELECT 1");
    log("Target connection OK");
  } catch (e) {
    console.error("Failed to connect to target (PlanetScale):", e);
    process.exit(1);
  }

  // Disable triggers
  await disableTriggers();

  try {
    // Step 1: Auth users
    await migrateUsers();
    // Step 2: Auth identities → accounts
    await migrateAccounts();
    // Step 3: App tables in FK dependency order
    await migrateYoutubeChannels();
    await migrateContainers();
    await migrateTemplates();
    await migrateYoutubeVideos();
    await migrateVideoVariables();
    await migrateDescriptionHistory();
    await migrateSubscriptions();
    await migrateWebhookEvents();
  } finally {
    // Always re-enable triggers
    await enableTriggers();
  }

  // Verify
  const allPassed = await verify();

  log("\n=== Migration Complete ===");
  if (allPassed) {
    log("All tables verified — row counts match.");
  } else {
    log("WARNING: Some tables have mismatched row counts. Check output above.");
  }

  // Close connections
  await source.end();
  await target.end();

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
