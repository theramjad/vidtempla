import { NextRequest, NextResponse } from "next/server";
import {
  withApiKey,
  apiSuccess,
  apiError,
  getChannelTokens,
  logRequest,
} from "@/lib/api-auth";
import axios from "axios";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * GET /api/v1/youtube/playlists/[id]/items?channelId=...&pageToken=...&maxResults=25
 * List items in a playlist
 * Quota cost: 1 unit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const pageToken = searchParams.get("pageToken");
  const maxResults = Math.min(
    parseInt(searchParams.get("maxResults") || "25", 10),
    50
  );

  if (!channelId) {
    await logRequest(ctx, `/youtube/playlists/${id}/items`, "GET", 0, 400);
    return NextResponse.json(
      apiError(
        "MISSING_PARAMETER",
        "channelId is required",
        "Provide a channelId query parameter",
        400
      ),
      { status: 400 }
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.userId);
  if ("error" in tokens) {
    await logRequest(ctx, `/youtube/playlists/${id}/items`, "GET", 0, tokens.status);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/playlistItems`, {
      params: {
        part: "snippet,contentDetails",
        playlistId: id,
        maxResults,
        ...(pageToken && { pageToken }),
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(ctx, `/youtube/playlists/${id}/items`, "GET", 1, 200);
    return NextResponse.json(
      apiSuccess(response.data.items || [], {
        quotaUnits: 1,
        pageInfo: response.data.pageInfo,
        nextPageToken: response.data.nextPageToken || null,
      })
    );
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, `/youtube/playlists/${id}/items`, "GET", 1, status);
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        message,
        "Check the playlist ID is correct",
        status
      ),
      { status }
    );
  }
}

/**
 * POST /api/v1/youtube/playlists/[id]/items
 * Add a video to a playlist
 * Body: { channelId, videoId }
 * Quota cost: 50 units
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;

  let body: { channelId?: string; videoId?: string };
  try {
    body = await request.json();
  } catch {
    await logRequest(ctx, `/youtube/playlists/${id}/items`, "POST", 0, 400);
    return NextResponse.json(
      apiError(
        "INVALID_BODY",
        "Request body must be valid JSON",
        "Send a JSON body with { channelId, videoId }",
        400
      ),
      { status: 400 }
    );
  }

  const { channelId, videoId } = body;

  if (!channelId || !videoId) {
    await logRequest(ctx, `/youtube/playlists/${id}/items`, "POST", 0, 400);
    return NextResponse.json(
      apiError(
        "MISSING_PARAMETER",
        "channelId and videoId are required",
        "Provide channelId and videoId in the request body",
        400
      ),
      { status: 400 }
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.userId);
  if ("error" in tokens) {
    await logRequest(ctx, `/youtube/playlists/${id}/items`, "POST", 0, tokens.status);
    return NextResponse.json(tokens.error, { status: tokens.status });
  }

  try {
    const response = await axios.post(
      `${YOUTUBE_API_BASE}/playlistItems`,
      {
        snippet: {
          playlistId: id,
          resourceId: {
            kind: "youtube#video",
            videoId,
          },
        },
      },
      {
        params: { part: "snippet" },
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    await logRequest(ctx, `/youtube/playlists/${id}/items`, "POST", 50, 201);
    return NextResponse.json(apiSuccess(response.data, { quotaUnits: 50 }));
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, `/youtube/playlists/${id}/items`, "POST", 50, status);
    return NextResponse.json(
      apiError(
        "YOUTUBE_API_ERROR",
        message,
        "Check the videoId and playlist permissions",
        status
      ),
      { status }
    );
  }
}
