import { NextRequest, NextResponse } from "next/server";
import { isNotNull, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { youtubeChannels } from "@/db/schema";
import { encrypt, decrypt } from "@/utils/encryption";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_EMAIL = "r@rayamjad.com";

type ChannelResult = {
  id: string;
  channelId: string;
  accessToken: "migrated" | "skipped" | "failed" | "not_present";
  refreshToken: "migrated" | "skipped" | "failed" | "not_present";
  error?: string;
};

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user || session.user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const oldKey = process.env.ENCRYPTION_KEY;
  const newKey = process.env.ENCRYPTION_KEY_V2;
  if (!oldKey || !newKey) {
    return NextResponse.json(
      { error: "ENCRYPTION_KEY and ENCRYPTION_KEY_V2 must both be set" },
      { status: 500 },
    );
  }
  if (oldKey === newKey) {
    return NextResponse.json(
      { error: "ENCRYPTION_KEY and ENCRYPTION_KEY_V2 are identical — nothing to rotate" },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const commit = url.searchParams.get("commit") === "true";

  const rows = await db
    .select({
      id: youtubeChannels.id,
      channelId: youtubeChannels.channelId,
      accessTokenEncrypted: youtubeChannels.accessTokenEncrypted,
      refreshTokenEncrypted: youtubeChannels.refreshTokenEncrypted,
    })
    .from(youtubeChannels);

  const results: ChannelResult[] = [];
  let migratedAccess = 0;
  let migratedRefresh = 0;
  let alreadyNew = 0;
  let failed = 0;

  for (const row of rows) {
    const result: ChannelResult = {
      id: row.id,
      channelId: row.channelId,
      accessToken: "not_present",
      refreshToken: "not_present",
    };

    let newAccess: string | null = null;
    let newRefresh: string | null = null;
    let rowFailed = false;

    if (row.accessTokenEncrypted) {
      const rotated = rotateCiphertext(row.accessTokenEncrypted, oldKey, newKey);
      result.accessToken = rotated.status;
      if (rotated.status === "skipped") alreadyNew++;
      if (rotated.status === "migrated") {
        migratedAccess++;
        newAccess = rotated.ciphertext;
      }
      if (rotated.status === "failed") {
        rowFailed = true;
        result.error = rotated.error;
      }
    }

    if (row.refreshTokenEncrypted) {
      const rotated = rotateCiphertext(row.refreshTokenEncrypted, oldKey, newKey);
      result.refreshToken = rotated.status;
      if (rotated.status === "skipped") alreadyNew++;
      if (rotated.status === "migrated") {
        migratedRefresh++;
        newRefresh = rotated.ciphertext;
      }
      if (rotated.status === "failed") {
        rowFailed = true;
        result.error = result.error ?? rotated.error;
      }
    }

    if (rowFailed) failed++;

    if (commit && !rowFailed && (newAccess !== null || newRefresh !== null)) {
      const patch: {
        accessTokenEncrypted?: string;
        refreshTokenEncrypted?: string;
      } = {};
      if (newAccess !== null) patch.accessTokenEncrypted = newAccess;
      if (newRefresh !== null) patch.refreshTokenEncrypted = newRefresh;
      await db.update(youtubeChannels).set(patch).where(eq(youtubeChannels.id, row.id));
    }

    results.push(result);
  }

  return NextResponse.json({
    mode: commit ? "commit" : "dry-run",
    totalChannels: rows.length,
    migratedAccess,
    migratedRefresh,
    alreadyOnNewKey: alreadyNew,
    failed,
    nextStep: commit
      ? failed > 0
        ? "Some rows failed — inspect `results` and rerun. Do NOT swap ENCRYPTION_KEY yet."
        : "All rows migrated. Now: set ENCRYPTION_KEY = ENCRYPTION_KEY_V2 in Vercel, redeploy, delete ENCRYPTION_KEY_V2."
      : "Dry-run complete. Append ?commit=true to actually write the re-encrypted tokens.",
    results,
  });
}

type RotateResult =
  | { status: "migrated"; ciphertext: string }
  | { status: "skipped" }
  | { status: "failed"; error: string };

function rotateCiphertext(ciphertext: string, oldKey: string, newKey: string): RotateResult {
  // Try the new key first — if it already decrypts, this row was migrated in a prior run.
  try {
    decrypt(ciphertext, newKey);
    return { status: "skipped" };
  } catch {
    // fall through to old-key path
  }

  try {
    const plaintext = decrypt(ciphertext, oldKey);
    const reencrypted = encrypt(plaintext, newKey);
    return { status: "migrated", ciphertext: reencrypted };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
