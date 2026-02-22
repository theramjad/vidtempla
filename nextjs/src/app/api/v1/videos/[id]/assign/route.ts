import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import {
  youtubeVideos,
  youtubeChannels,
  containers,
  templates,
  videoVariables,
} from "@/db/schema";
import { eq, and, inArray, count, sql } from "drizzle-orm";
import { parseUserVariables } from "@/utils/templateParser";
import { checkVideoLimit } from "@/lib/plan-limits";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const { containerId } = body;

    if (!containerId) {
      logRequest(auth, `/v1/videos/${id}/assign`, "POST", 400, 0);
      return NextResponse.json(
        apiError(
          "MISSING_CONTAINER_ID",
          "containerId is required in request body",
          'Send { "containerId": "uuid" }',
          400
        ),
        { status: 400 }
      );
    }

    // Verify the video exists and belongs to the user
    const [video] = await db
      .select({
        id: youtubeVideos.id,
        containerId: youtubeVideos.containerId,
        channelId: youtubeVideos.channelId,
      })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .where(
        and(eq(youtubeVideos.id, id), eq(youtubeChannels.userId, auth.userId))
      );

    if (!video) {
      logRequest(auth, `/v1/videos/${id}/assign`, "POST", 404, 0);
      return NextResponse.json(
        apiError("VIDEO_NOT_FOUND", "Video not found", "Check the video ID", 404),
        { status: 404 }
      );
    }

    if (video.containerId) {
      logRequest(auth, `/v1/videos/${id}/assign`, "POST", 400, 0);
      return NextResponse.json(
        apiError(
          "ALREADY_ASSIGNED",
          "Video is already assigned to a container",
          "Unassign the video first or use a different video",
          400
        ),
        { status: 400 }
      );
    }

    // Check video limit
    const channels = await db
      .select({ id: youtubeChannels.id })
      .from(youtubeChannels)
      .where(eq(youtubeChannels.userId, auth.userId));

    const channelIds = channels.map((c) => c.id);

    if (channelIds.length > 0) {
      const [countResult] = await db
        .select({ assignedCount: count() })
        .from(youtubeVideos)
        .where(
          and(
            inArray(youtubeVideos.channelId, channelIds),
            sql`${youtubeVideos.containerId} IS NOT NULL`
          )
        );

      const limitCheck = await checkVideoLimit(auth.userId, db);

      if ((countResult?.assignedCount ?? 0) >= limitCheck.limit) {
        logRequest(auth, `/v1/videos/${id}/assign`, "POST", 403, 0);
        return NextResponse.json(
          apiError(
            "VIDEO_LIMIT_REACHED",
            `Assigned video limit reached (${limitCheck.limit} on ${limitCheck.planTier} plan)`,
            "Upgrade your plan to assign more videos",
            403
          ),
          { status: 403 }
        );
      }
    }

    // Verify the container exists and belongs to user
    const [container] = await db
      .select({ id: containers.id, templateOrder: containers.templateOrder })
      .from(containers)
      .where(
        and(eq(containers.id, containerId), eq(containers.userId, auth.userId))
      );

    if (!container) {
      logRequest(auth, `/v1/videos/${id}/assign`, "POST", 404, 0);
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

    // Assign
    await db
      .update(youtubeVideos)
      .set({ containerId })
      .where(eq(youtubeVideos.id, id));

    // Initialize variables
    if (container.templateOrder && container.templateOrder.length > 0) {
      const templatesData = await db
        .select({ id: templates.id, content: templates.content })
        .from(templates)
        .where(inArray(templates.id, container.templateOrder));

      const variablesToCreate: Array<{
        videoId: string;
        templateId: string;
        variableName: string;
        variableValue: string;
      }> = [];

      for (const template of templatesData) {
        const variables = parseUserVariables(template.content);
        for (const varName of variables) {
          variablesToCreate.push({
            videoId: id,
            templateId: template.id,
            variableName: varName,
            variableValue: "",
          });
        }
      }

      if (variablesToCreate.length > 0) {
        await db.insert(videoVariables).values(variablesToCreate);
      }
    }

    logRequest(auth, `/v1/videos/${id}/assign`, "POST", 200, 0);
    return NextResponse.json(apiSuccess({ success: true }));
  } catch (error) {
    logRequest(auth, `/v1/videos/${id}/assign`, "POST", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to assign video",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
