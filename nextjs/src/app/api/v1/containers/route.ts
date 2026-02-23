import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import { containers, youtubeVideos } from "@/db/schema";
import { eq, and, desc, lt, count, getTableColumns } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") ?? "50"),
      100
    );

    const filters: ReturnType<typeof eq>[] = [
      eq(containers.userId, auth.userId),
    ];

    if (cursor) {
      filters.push(lt(containers.createdAt, new Date(cursor)));
    }

    const results = await db
      .select({
        ...getTableColumns(containers),
        videoCount: count(youtubeVideos.id),
      })
      .from(containers)
      .leftJoin(youtubeVideos, eq(youtubeVideos.containerId, containers.id))
      .where(and(...filters))
      .groupBy(containers.id)
      .orderBy(desc(containers.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1]!.createdAt.toISOString()
        : undefined;

    const [totalResult] = await db
      .select({ total: count() })
      .from(containers)
      .where(eq(containers.userId, auth.userId));

    logRequest(auth, "/v1/containers", "GET", 200, 0);
    return NextResponse.json(
      apiSuccess(items, {
        cursor: nextCursor,
        hasMore,
        total: totalResult?.total ?? 0,
      })
    );
  } catch (error) {
    logRequest(auth, "/v1/containers", "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch containers",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  try {
    const body = await request.json();
    const { name, templateIds, separator } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      logRequest(auth, "/v1/containers", "POST", 400, 0);
      return NextResponse.json(
        apiError(
          "INVALID_NAME",
          "name is required",
          'Send { "name": "My Container", "templateIds": ["..."] }',
          400
        ),
        { status: 400 }
      );
    }

    if (!Array.isArray(templateIds)) {
      logRequest(auth, "/v1/containers", "POST", 400, 0);
      return NextResponse.json(
        apiError(
          "INVALID_TEMPLATE_IDS",
          "templateIds must be an array of template UUIDs",
          'Send { "name": "...", "templateIds": ["template-uuid-1", "template-uuid-2"] }',
          400
        ),
        { status: 400 }
      );
    }

    const [container] = await db
      .insert(containers)
      .values({
        userId: auth.userId,
        name: name.trim(),
        templateOrder: templateIds,
        separator: separator ?? "\n\n",
      })
      .returning();

    logRequest(auth, "/v1/containers", "POST", 201, 0);
    return NextResponse.json(apiSuccess(container), { status: 201 });
  } catch (error) {
    logRequest(auth, "/v1/containers", "POST", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to create container",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
