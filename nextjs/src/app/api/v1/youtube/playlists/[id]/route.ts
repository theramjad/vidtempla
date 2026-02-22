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
 * GET /api/v1/youtube/playlists/[id]?channelId=...
 * Get playlist details
 * Quota cost: 1 unit
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    await logRequest(ctx, `/youtube/playlists/${id}`, "GET", 0, 400);
    return apiError(
      "MISSING_PARAMETER",
      "channelId is required",
      "Provide a channelId query parameter to identify the channel",
      400
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.user.id);
  if (tokens instanceof Response) {
    await logRequest(ctx, `/youtube/playlists/${id}`, "GET", 0, 403);
    return tokens;
  }

  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/playlists`, {
      params: {
        part: "snippet,contentDetails,status",
        id,
      },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    const playlist = response.data.items?.[0];
    if (!playlist) {
      await logRequest(ctx, `/youtube/playlists/${id}`, "GET", 1, 404);
      return apiError(
        "NOT_FOUND",
        "Playlist not found",
        "Check the playlist ID is correct",
        404
      );
    }

    await logRequest(ctx, `/youtube/playlists/${id}`, "GET", 1, 200);
    return apiSuccess(playlist, { quotaUnits: 1 });
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, `/youtube/playlists/${id}`, "GET", 1, status);
    return apiError("YOUTUBE_API_ERROR", message, "Check the playlist ID", status);
  }
}

/**
 * PATCH /api/v1/youtube/playlists/[id]
 * Update a playlist
 * Body: { channelId, title?, description?, privacyStatus? }
 * Quota cost: 50 units
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;

  let body: {
    channelId?: string;
    title?: string;
    description?: string;
    privacyStatus?: string;
  };
  try {
    body = await request.json();
  } catch {
    await logRequest(ctx, `/youtube/playlists/${id}`, "PATCH", 0, 400);
    return apiError(
      "INVALID_BODY",
      "Request body must be valid JSON",
      "Send a JSON body with { channelId, title?, description?, privacyStatus? }",
      400
    );
  }

  const { channelId, title, description, privacyStatus } = body;

  if (!channelId) {
    await logRequest(ctx, `/youtube/playlists/${id}`, "PATCH", 0, 400);
    return apiError(
      "MISSING_PARAMETER",
      "channelId is required",
      "Provide channelId in the request body",
      400
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.user.id);
  if (tokens instanceof Response) {
    await logRequest(ctx, `/youtube/playlists/${id}`, "PATCH", 0, 403);
    return tokens;
  }

  // First fetch the current playlist to preserve fields not being updated
  try {
    const current = await axios.get(`${YOUTUBE_API_BASE}/playlists`, {
      params: { part: "snippet,status", id },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    const existing = current.data.items?.[0];
    if (!existing) {
      await logRequest(ctx, `/youtube/playlists/${id}`, "PATCH", 1, 404);
      return apiError(
        "NOT_FOUND",
        "Playlist not found",
        "Check the playlist ID is correct",
        404
      );
    }

    const response = await axios.put(
      `${YOUTUBE_API_BASE}/playlists`,
      {
        id,
        snippet: {
          title: title || existing.snippet.title,
          description:
            description !== undefined
              ? description
              : existing.snippet.description,
        },
        status: {
          privacyStatus: privacyStatus || existing.status.privacyStatus,
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

    await logRequest(ctx, `/youtube/playlists/${id}`, "PATCH", 50, 200);
    return apiSuccess(response.data, { quotaUnits: 50 });
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, `/youtube/playlists/${id}`, "PATCH", 50, status);
    return apiError("YOUTUBE_API_ERROR", message, "Check your input values", status);
  }
}

/**
 * DELETE /api/v1/youtube/playlists/[id]?channelId=...
 * Delete a playlist
 * Quota cost: 50 units
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await withApiKey(request);
  if (ctx instanceof Response) return ctx;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get("channelId");

  if (!channelId) {
    await logRequest(ctx, `/youtube/playlists/${id}`, "DELETE", 0, 400);
    return apiError(
      "MISSING_PARAMETER",
      "channelId is required",
      "Provide a channelId query parameter",
      400
    );
  }

  const tokens = await getChannelTokens(channelId, ctx.user.id);
  if (tokens instanceof Response) {
    await logRequest(ctx, `/youtube/playlists/${id}`, "DELETE", 0, 403);
    return tokens;
  }

  try {
    await axios.delete(`${YOUTUBE_API_BASE}/playlists`, {
      params: { id },
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    await logRequest(ctx, `/youtube/playlists/${id}`, "DELETE", 50, 200);
    return apiSuccess({ deleted: true }, { quotaUnits: 50 });
  } catch (error) {
    const status = axios.isAxiosError(error)
      ? error.response?.status || 500
      : 500;
    const message = axios.isAxiosError(error)
      ? error.response?.data?.error?.message || error.message
      : "Unknown error";
    await logRequest(ctx, `/youtube/playlists/${id}`, "DELETE", 50, status);
    return apiError(
      "YOUTUBE_API_ERROR",
      message,
      "Check the playlist ID and your permissions",
      status
    );
  }
}
