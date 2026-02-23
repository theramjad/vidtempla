import { NextRequest, NextResponse } from "next/server";
import { withApiKey, requireWriteAccess, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import {
  youtubeVideos,
  youtubeChannels,
  videoVariables,
  templates,
  containers,
} from "@/db/schema";
import { eq, and, getTableColumns } from "drizzle-orm";
import { inngestClient } from "@/lib/clients/inngest";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // Verify ownership
    const [video] = await db
      .select({ id: youtubeVideos.id })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .where(
        and(eq(youtubeVideos.id, id), eq(youtubeChannels.userId, auth.userId))
      );

    if (!video) {
      logRequest(auth, `/v1/videos/${id}/variables`, "GET", 404, 0);
      return NextResponse.json(
        apiError("VIDEO_NOT_FOUND", "Video not found", "Check the video ID", 404),
        { status: 404 }
      );
    }

    const variables = await db
      .select({
        ...getTableColumns(videoVariables),
        template: {
          id: templates.id,
          name: templates.name,
        },
      })
      .from(videoVariables)
      .leftJoin(templates, eq(videoVariables.templateId, templates.id))
      .where(eq(videoVariables.videoId, id));

    logRequest(auth, `/v1/videos/${id}/variables`, "GET", 200, 0);
    return NextResponse.json(apiSuccess(variables));
  } catch (error) {
    logRequest(auth, `/v1/videos/${id}/variables`, "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch variables",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const { variables } = body;

    if (!Array.isArray(variables)) {
      logRequest(auth, `/v1/videos/${id}/variables`, "PUT", 400, 0);
      return NextResponse.json(
        apiError(
          "INVALID_BODY",
          "Request body must contain a 'variables' array",
          'Send { "variables": [{ "templateId": "...", "name": "...", "value": "..." }] }',
          400
        ),
        { status: 400 }
      );
    }

    // Verify ownership
    const [video] = await db
      .select({ id: youtubeVideos.id })
      .from(youtubeVideos)
      .innerJoin(youtubeChannels, eq(youtubeVideos.channelId, youtubeChannels.id))
      .where(
        and(eq(youtubeVideos.id, id), eq(youtubeChannels.userId, auth.userId))
      );

    if (!video) {
      logRequest(auth, `/v1/videos/${id}/variables`, "PUT", 404, 0);
      return NextResponse.json(
        apiError("VIDEO_NOT_FOUND", "Video not found", "Check the video ID", 404),
        { status: 404 }
      );
    }

    // Upsert all variables
    for (const variable of variables) {
      await db
        .insert(videoVariables)
        .values({
          videoId: id,
          templateId: variable.templateId,
          variableName: variable.name,
          variableValue: variable.value,
        })
        .onConflictDoUpdate({
          target: [
            videoVariables.videoId,
            videoVariables.templateId,
            videoVariables.variableName,
          ],
          set: { variableValue: variable.value },
        });
    }

    // Trigger description rebuild
    await inngestClient.send({
      name: "youtube/videos.update",
      data: {
        videoIds: [id],
        userId: auth.userId,
      },
    });

    logRequest(auth, `/v1/videos/${id}/variables`, "PUT", 200, 0);
    return NextResponse.json(apiSuccess({ success: true }));
  } catch (error) {
    logRequest(auth, `/v1/videos/${id}/variables`, "PUT", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to update variables",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
