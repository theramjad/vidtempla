import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import {
  templates,
  containers,
  youtubeVideos,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { parseVariables } from "@/utils/templateParser";
import { inngestClient } from "@/lib/clients/inngest";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const [template] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.userId, auth.userId)));

    if (!template) {
      logRequest(auth, `/v1/templates/${id}`, "GET", 404, 0);
      return NextResponse.json(
        apiError(
          "TEMPLATE_NOT_FOUND",
          "Template not found",
          "Check the template ID",
          404
        ),
        { status: 404 }
      );
    }

    logRequest(auth, `/v1/templates/${id}`, "GET", 200, 0);
    return NextResponse.json(
      apiSuccess({
        ...template,
        variables: parseVariables(template.content),
      })
    );
  } catch (error) {
    logRequest(auth, `/v1/templates/${id}`, "GET", 500, 0);
    return NextResponse.json(
      apiError("INTERNAL_ERROR", "Failed to fetch template", "Try again later", 500),
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const { id } = await params;

  try {
    const body = await request.json();
    const updateData: { name?: string; content?: string } = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.content !== undefined) updateData.content = body.content;

    if (Object.keys(updateData).length === 0) {
      logRequest(auth, `/v1/templates/${id}`, "PATCH", 400, 0);
      return NextResponse.json(
        apiError(
          "EMPTY_UPDATE",
          "At least one field (name or content) must be provided",
          'Send { "name": "..." } or { "content": "..." }',
          400
        ),
        { status: 400 }
      );
    }

    const [template] = await db
      .update(templates)
      .set(updateData)
      .where(and(eq(templates.id, id), eq(templates.userId, auth.userId)))
      .returning();

    if (!template) {
      logRequest(auth, `/v1/templates/${id}`, "PATCH", 404, 0);
      return NextResponse.json(
        apiError(
          "TEMPLATE_NOT_FOUND",
          "Template not found",
          "Check the template ID",
          404
        ),
        { status: 404 }
      );
    }

    // If content changed, trigger rebuild for affected videos
    if (body.content !== undefined) {
      const allContainers = await db
        .select({ id: containers.id, templateOrder: containers.templateOrder })
        .from(containers)
        .where(eq(containers.userId, auth.userId));

      const affectedContainers = allContainers.filter(
        (c) => Array.isArray(c.templateOrder) && c.templateOrder.includes(id)
      );

      if (affectedContainers.length > 0) {
        const containerIds = affectedContainers.map((c) => c.id);
        const videos = await db
          .select({ id: youtubeVideos.id })
          .from(youtubeVideos)
          .where(inArray(youtubeVideos.containerId, containerIds));

        if (videos.length > 0) {
          await inngestClient.send({
            name: "youtube/videos.update",
            data: {
              videoIds: videos.map((v) => v.id),
              userId: auth.userId,
            },
          });
        }
      }
    }

    logRequest(auth, `/v1/templates/${id}`, "PATCH", 200, 0);
    return NextResponse.json(
      apiSuccess({
        ...template,
        variables: parseVariables(template.content),
      })
    );
  } catch (error) {
    logRequest(auth, `/v1/templates/${id}`, "PATCH", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to update template",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;
  const writeCheck = requireWriteAccess(auth);
  if (writeCheck) return writeCheck;

  const { id } = await params;

  try {
    const result = await db
      .delete(templates)
      .where(and(eq(templates.id, id), eq(templates.userId, auth.userId)))
      .returning({ id: templates.id });

    if (result.length === 0) {
      logRequest(auth, `/v1/templates/${id}`, "DELETE", 404, 0);
      return NextResponse.json(
        apiError(
          "TEMPLATE_NOT_FOUND",
          "Template not found",
          "Check the template ID",
          404
        ),
        { status: 404 }
      );
    }

    logRequest(auth, `/v1/templates/${id}`, "DELETE", 200, 0);
    return NextResponse.json(apiSuccess({ success: true }));
  } catch (error) {
    logRequest(auth, `/v1/templates/${id}`, "DELETE", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to delete template",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
