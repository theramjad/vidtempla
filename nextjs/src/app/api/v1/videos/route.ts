import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import {
  youtubeVideos,
  youtubeChannels,
  containers,
} from "@/db/schema";
import {
  eq,
  and,
  desc,
  asc,
  ilike,
  isNull,
  lt,
  gt,
  count,
  getTableColumns,
} from "drizzle-orm";

export async function GET(request: NextRequest) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(request.url);
    const channelId = url.searchParams.get("channelId");
    const containerId = url.searchParams.get("containerId");
    const search = url.searchParams.get("search");
    const unassigned = url.searchParams.get("unassigned") === "true";
    const sortParam = url.searchParams.get("sort") ?? "publishedAt:desc";
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

    const filters: ReturnType<typeof eq>[] = [
      eq(youtubeChannels.userId, auth.userId),
    ];

    if (channelId) {
      filters.push(eq(youtubeChannels.channelId, channelId));
    }

    if (containerId) {
      filters.push(eq(youtubeVideos.containerId, containerId));
    }

    if (search) {
      filters.push(ilike(youtubeVideos.title, `%${search}%`));
    }

    if (unassigned) {
      filters.push(isNull(youtubeVideos.containerId));
    }

    if (cursor) {
      // Cursor is the publishedAt timestamp of the last item
      const [sortField, sortDir] = sortParam.split(":");
      if (sortDir === "asc") {
        filters.push(gt(youtubeVideos.publishedAt, new Date(cursor)));
      } else {
        filters.push(lt(youtubeVideos.publishedAt, new Date(cursor)));
      }
    }

    // Parse sort
    const [sortField, sortDir] = sortParam.split(":");
    const orderBy =
      sortField === "title"
        ? sortDir === "asc"
          ? asc(youtubeVideos.title)
          : desc(youtubeVideos.title)
        : sortDir === "asc"
          ? asc(youtubeVideos.publishedAt)
          : desc(youtubeVideos.publishedAt);

    const results = await db
      .select({
        ...getTableColumns(youtubeVideos),
        channel: {
          id: youtubeChannels.id,
          channelId: youtubeChannels.channelId,
          title: youtubeChannels.title,
        },
        container: {
          id: containers.id,
          name: containers.name,
        },
      })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .leftJoin(containers, eq(youtubeVideos.containerId, containers.id))
      .where(and(...filters))
      .orderBy(orderBy)
      .limit(limit + 1); // Fetch one extra to check hasMore

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1]!.publishedAt?.toISOString()
        : undefined;

    // Get total count (without cursor)
    const baseFilters: ReturnType<typeof eq>[] = [
      eq(youtubeChannels.userId, auth.userId),
    ];
    if (channelId) baseFilters.push(eq(youtubeChannels.channelId, channelId));
    if (containerId) baseFilters.push(eq(youtubeVideos.containerId, containerId));
    if (search) baseFilters.push(ilike(youtubeVideos.title, `%${search}%`));
    if (unassigned) baseFilters.push(isNull(youtubeVideos.containerId));

    const [totalResult] = await db
      .select({ total: count() })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .where(and(...baseFilters));

    logRequest(auth, "/v1/videos", "GET", 200, 0);
    return NextResponse.json(
      apiSuccess(items, {
        cursor: nextCursor,
        hasMore,
        total: totalResult?.total ?? 0,
      })
    );
  } catch (error) {
    logRequest(auth, "/v1/videos", "GET", 500, 0);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to fetch videos", "Try again later", 500),
      { status: 500 }
    );
  }
}
