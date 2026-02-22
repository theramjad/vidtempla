import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import {
  containers,
  templates,
  youtubeVideos,
} from "@/db/schema";
import { eq, and, inArray, count, getTableColumns } from "drizzle-orm";
import { inngestClient } from "@/lib/clients/inngest";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const [container] = await db
      .select({
        ...getTableColumns(containers),
        videoCount: count(youtubeVideos.id),
      })
      .from(containers)
      .leftJoin(youtubeVideos, eq(youtubeVideos.containerId, containers.id))
      .where(and(eq(containers.id, id), eq(containers.userId, auth.userId)))
      .groupBy(containers.id);

    if (!container) {
      logRequest(auth, `/v1/containers/${id}`, "GET", 404, 0);
      return NextResponse.json(
        apiError(
          "CONTAINER_NOT_FOUND",
          "Container not found",
          "Check the container ID",
          404
        ),
        { status: 404 }
      );
    }

    // Fetch template details if there are templates
    let templateDetails: Array<{
      id: string;
      name: string;
      content: string;
    }> = [];

    if (container.templateOrder && container.templateOrder.length > 0) {
      templateDetails = await db
        .select({
          id: templates.id,
          name: templates.name,
          content: templates.content,
        })
        .from(templates)
        .where(inArray(templates.id, container.templateOrder));

      // Sort by templateOrder
      templateDetails.sort(
        (a, b) =>
          container.templateOrder!.indexOf(a.id) -
          container.templateOrder!.indexOf(b.id)
      );
    }

    logRequest(auth, `/v1/containers/${id}`, "GET", 200, 0);
    return NextResponse.json(
      apiSuccess({
        ...container,
        templates: templateDetails,
      })
    );
  } catch (error) {
    logRequest(auth, `/v1/containers/${id}`, "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch container",
        "Try again later",
        500
      ),
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

  const { id } = await params;

  try {
    const body = await request.json();
    const updateData: {
      name?: string;
      templateOrder?: string[];
      separator?: string;
    } = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.templateIds !== undefined)
      updateData.templateOrder = body.templateIds;
    if (body.separator !== undefined) updateData.separator = body.separator;

    if (Object.keys(updateData).length === 0) {
      logRequest(auth, `/v1/containers/${id}`, "PATCH", 400, 0);
      return NextResponse.json(
        apiError(
          "EMPTY_UPDATE",
          "At least one field must be provided",
          'Send { "name": "..." }, { "templateIds": [...] }, or { "separator": "..." }',
          400
        ),
        { status: 400 }
      );
    }

    const [container] = await db
      .update(containers)
      .set(updateData)
      .where(and(eq(containers.id, id), eq(containers.userId, auth.userId)))
      .returning();

    if (!container) {
      logRequest(auth, `/v1/containers/${id}`, "PATCH", 404, 0);
      return NextResponse.json(
        apiError(
          "CONTAINER_NOT_FOUND",
          "Container not found",
          "Check the container ID",
          404
        ),
        { status: 404 }
      );
    }

    // Trigger rebuild if templateIds or separator changed
    if (
      body.templateIds !== undefined ||
      body.separator !== undefined
    ) {
      const videos = await db
        .select({ id: youtubeVideos.id })
        .from(youtubeVideos)
        .where(eq(youtubeVideos.containerId, id));

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

    logRequest(auth, `/v1/containers/${id}`, "PATCH", 200, 0);
    return NextResponse.json(apiSuccess(container));
  } catch (error) {
    logRequest(auth, `/v1/containers/${id}`, "PATCH", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to update container",
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

  const { id } = await params;

  try {
    const result = await db
      .delete(containers)
      .where(and(eq(containers.id, id), eq(containers.userId, auth.userId)))
      .returning({ id: containers.id });

    if (result.length === 0) {
      logRequest(auth, `/v1/containers/${id}`, "DELETE", 404, 0);
      return NextResponse.json(
        apiError(
          "CONTAINER_NOT_FOUND",
          "Container not found",
          "Check the container ID",
          404
        ),
        { status: 404 }
      );
    }

    logRequest(auth, `/v1/containers/${id}`, "DELETE", 200, 0);
    return NextResponse.json(apiSuccess({ success: true }));
  } catch (error) {
    logRequest(auth, `/v1/containers/${id}`, "DELETE", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to delete container",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
