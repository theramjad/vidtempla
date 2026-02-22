import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import { templates } from "@/db/schema";
import { eq, and, desc, lt, count } from "drizzle-orm";
import { parseVariables } from "@/utils/templateParser";

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
      eq(templates.userId, auth.userId),
    ];

    if (cursor) {
      filters.push(lt(templates.createdAt, new Date(cursor)));
    }

    const results = await db
      .select()
      .from(templates)
      .where(and(...filters))
      .orderBy(desc(templates.createdAt))
      .limit(limit + 1);

    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor =
      hasMore && items.length > 0
        ? items[items.length - 1]!.createdAt.toISOString()
        : undefined;

    const templatesWithVars = items.map((t) => ({
      ...t,
      variables: parseVariables(t.content),
    }));

    const [totalResult] = await db
      .select({ total: count() })
      .from(templates)
      .where(eq(templates.userId, auth.userId));

    logRequest(auth, "/v1/templates", "GET", 200, 0);
    return NextResponse.json(
      apiSuccess(templatesWithVars, {
        cursor: nextCursor,
        hasMore,
        total: totalResult?.total ?? 0,
      })
    );
  } catch (error) {
    logRequest(auth, "/v1/templates", "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch templates",
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

  try {
    const body = await request.json();
    const { name, content } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      logRequest(auth, "/v1/templates", "POST", 400, 0);
      return NextResponse.json(
        apiError(
          "INVALID_NAME",
          "name is required",
          'Send { "name": "My Template", "content": "..." }',
          400
        ),
        { status: 400 }
      );
    }

    if (content === undefined || typeof content !== "string") {
      logRequest(auth, "/v1/templates", "POST", 400, 0);
      return NextResponse.json(
        apiError(
          "INVALID_CONTENT",
          "content is required",
          'Send { "name": "...", "content": "Template text with {{variables}}" }',
          400
        ),
        { status: 400 }
      );
    }

    const [template] = await db
      .insert(templates)
      .values({
        userId: auth.userId,
        name: name.trim(),
        content,
      })
      .returning();

    logRequest(auth, "/v1/templates", "POST", 201, 0);
    return NextResponse.json(
      apiSuccess({
        ...template,
        variables: parseVariables(content),
      }),
      { status: 201 }
    );
  } catch (error) {
    logRequest(auth, "/v1/templates", "POST", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to create template",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
