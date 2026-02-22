import { NextRequest, NextResponse } from "next/server";
import { withApiKey, apiSuccess, apiError, logRequest } from "@/lib/api-auth";
import { db } from "@/db";
import {
  templates,
  containers,
  youtubeVideos,
} from "@/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await withApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    // Verify template exists and belongs to user
    const [template] = await db
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.userId, auth.userId)));

    if (!template) {
      logRequest(auth, `/v1/templates/${id}/impact`, "GET", 404, 0);
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

    // Find all containers using this template
    const allContainers = await db
      .select({
        id: containers.id,
        name: containers.name,
        templateOrder: containers.templateOrder,
      })
      .from(containers)
      .where(eq(containers.userId, auth.userId));

    const affectedContainers = allContainers.filter(
      (c) => Array.isArray(c.templateOrder) && c.templateOrder.includes(id)
    );

    if (affectedContainers.length === 0) {
      logRequest(auth, `/v1/templates/${id}/impact`, "GET", 200, 0);
      return NextResponse.json(
        apiSuccess({ containers: [], videos: [], count: 0 })
      );
    }

    const containerIds = affectedContainers.map((c) => c.id);

    const videos = await db
      .select({
        id: youtubeVideos.id,
        title: youtubeVideos.title,
        videoId: youtubeVideos.videoId,
        containerId: youtubeVideos.containerId,
      })
      .from(youtubeVideos)
      .where(inArray(youtubeVideos.containerId, containerIds))
      .orderBy(asc(youtubeVideos.title));

    const containerInfo = affectedContainers.map((container) => ({
      id: container.id,
      name: container.name,
      videoCount: videos.filter((v) => v.containerId === container.id).length,
    }));

    logRequest(auth, `/v1/templates/${id}/impact`, "GET", 200, 0);
    return NextResponse.json(
      apiSuccess({
        containers: containerInfo,
        videos,
        count: videos.length,
      })
    );
  } catch (error) {
    logRequest(auth, `/v1/templates/${id}/impact`, "GET", 500, 0);
    return NextResponse.json(
      apiError(
        "INTERNAL_ERROR",
        "Failed to fetch template impact",
        "Try again later",
        500
      ),
      { status: 500 }
    );
  }
}
