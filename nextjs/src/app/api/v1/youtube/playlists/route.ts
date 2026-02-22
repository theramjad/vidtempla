import { NextRequest } from "next/server";
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
 * GET /api/v1/youtube/playlists?channelId=...&pageToken=...&maxResults=25
 * List playlists for a channel
 * Quota cost: 1 unit
 */
export async function GET(request: NextRequest) {
  const ctx = await withApiKey(request);
  if (ctx instanceof Response) return ctx;

  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");
  const pageToken = searchParams.get("pageToken");
  const maxResults = Math.min(
    parseInt(searchParams.get("maxResults") || "25", 10),
    50
  );

  if (!channelId) {
    await logRequest(ctx, "/youtube/playlists", "GET", 0, 400);
    return apiError(
      "MISSING_PARAMETER",
      "channelId is required",
      "Provide a channelId query parameter for the YouTube channel",
      400
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.user.id);
  if (tokens instanceof Response) {
    await logRequest(ctx, "/youtube/playlists", "GET", 0, 403);
    return tokens;
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/playlists`, {
      params: {
        part: "snippet,contentDetails,status",
        channelId,
        maxResults,
        ...(pageToken && { pageToken }),
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(ctx, "/youtube/playlists", "GET", 1, 200);
    return apiSuccess(response.data.items || [], {
      quotaUnits: 1,
      pageInfo: response.data.pageInfo,
      nextPageToken: response.data.nextPageToken || null,
    });
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, "/youtube/playlists", "GET", 1, status);
    return apiError(
      "YOUTUBE_API_ERROR",
      message,
      "Check that the channelId is correct and the channel has playlists",
      status
    );
  }
}

/**
 * POST /api/v1/youtube/playlists
 * Create a new playlist
 * Body: { channelId, title, description?, privacyStatus? }
 * Quota cost: 50 units
 */
export async function POST(request: NextRequest) {
  const ctx = await withApiKey(request);
  if (ctx instanceof Response) return ctx;

  let body: {
    channelId?: string;
    title?: string;
    description?: string;
    privacyStatus?: string;
  };
  try {
    body = await request.json();
  } catch {
    await logRequest(ctx, "/youtube/playlists", "POST", 0, 400);
    return apiError(
      "INVALID_BODY",
      "Request body must be valid JSON",
      "Send a JSON body with { channelId, title, description?, privacyStatus? }",
      400
    );
  }

  const { channelId, title, description, privacyStatus } = body;

  if (!channelId || !title) {
    await logRequest(ctx, "/youtube/playlists", "POST", 0, 400);
    return apiError(
      "MISSING_PARAMETER",
      "channelId and title are required",
      "Provide channelId and title in the request body",
      400
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.user.id);
  if (tokens instanceof Response) {
    await logRequest(ctx, "/youtube/playlists", "POST", 0, 403);
    return tokens;
  }

  try {
    const response = await axios.post(
      `${YOUTUBE_API_BASE}/playlists`,
      {
        snippet: {
          title,
          description: description || "",
        },
        status: {
          privacyStatus: privacyStatus || "private",
        },
      },
      {
        params: { part: "snippet,status" },
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    await logRequest(ctx, "/youtube/playlists", "POST", 50, 201);
    return apiSuccess(response.data, { quotaUnits: 50 });
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, "/youtube/playlists", "POST", 50, status);
    return apiError(
      "YOUTUBE_API_ERROR",
      message,
      "Check that the title is valid and you have permission to create playlists",
      status
    );
  }
}
