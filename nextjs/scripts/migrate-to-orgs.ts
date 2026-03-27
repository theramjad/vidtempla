/**
 * One-time data migration: create personal organizations for existing users
 * and reassign all resources from userId to organizationId.
 *
 * Usage:
 *   cd nextjs
 *   npx tsx scripts/migrate-to-orgs.ts
 *
 * Prerequisites:
 *   - Run drizzle-kit migrate first to apply the schema changes
 *   - Set DATABASE_URL in environment
 *
 * This script is idempotent — it skips users who already have an org membership.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(DATABASE_URL);
const db = drizzle(client, { schema });

async function main() {
  console.log("Starting org migration...");

  // Get all users
  const users = await db.select().from(schema.user);
  console.log(`Found ${users.length} users to migrate`);

  let created = 0;
  let skipped = 0;

  for (const user of users) {
    // Check if user already has a membership (idempotent)
    const [existing] = await db
      .select({ id: schema.member.id })
      .from(schema.member)
      .where(eq(schema.member.userId, user.id))
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    const orgId = crypto.randomUUID();
    const localPart = (user.email.split("@")[0] ?? "user")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
    const slug = `${localPart}-${orgId.slice(0, 6)}`;

    // Create org + membership in a transaction
    await db.transaction(async (tx) => {
      // Create organization
      await tx.insert(schema.organization).values({
        id: orgId,
        name: user.name || user.email.split("@")[0] || "My Organization",
        slug,
        createdAt: new Date(),
      });

      // Create owner membership
      await tx.insert(schema.member).values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        userId: user.id,
        role: "owner",
        createdAt: new Date(),
      });

      // Update all resource tables
      await tx
        .update(schema.youtubeChannels)
        .set({ organizationId: orgId })
        .where(eq(schema.youtubeChannels.userId, user.id));

      await tx
        .update(schema.containers)
        .set({ organizationId: orgId })
        .where(eq(schema.containers.userId, user.id));

      await tx
        .update(schema.templates)
        .set({ organizationId: orgId })
        .where(eq(schema.templates.userId, user.id));

      await tx
        .update(schema.subscriptions)
        .set({ organizationId: orgId })
        .where(eq(schema.subscriptions.userId, user.id));

      await tx
        .update(schema.userCredits)
        .set({ organizationId: orgId })
        .where(eq(schema.userCredits.userId, user.id));

      await tx
        .update(schema.apiKeys)
        .set({ organizationId: orgId })
        .where(eq(schema.apiKeys.userId, user.id));

      await tx
        .update(schema.apiRequestLog)
        .set({ organizationId: orgId })
        .where(eq(schema.apiRequestLog.userId, user.id));
    });

    created++;
    console.log(`  ✓ ${user.email} → org "${slug}"`);
  }

  console.log(`\nDone! Created ${created} orgs, skipped ${skipped} (already migrated)`);
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
