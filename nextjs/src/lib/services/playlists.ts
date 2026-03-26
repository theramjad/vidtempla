import { getChannelTokens } from "@/lib/api-auth";
import {
  listPlaylists as ytListPlaylists,
  createPlaylist as ytCreatePlaylist,
  getPlaylist as ytGetPlaylist,
  updatePlaylist as ytUpdatePlaylist,
  deletePlaylist as ytDeletePlaylist,
  listPlaylistItems as ytListPlaylistItems,
  addPlaylistItem as ytAddPlaylistItem,
  deletePlaylistItem as ytDeletePlaylistItem,
} from "@/lib/clients/youtube";
import type { ServiceResult } from "./types";

// ── list_playlists ───────────────────────────────────────────

export async function listPlaylists(
  channelId: string,
  userId: string,
  opts: { maxResults?: number; pageToken?: string } = {}
): Promise<ServiceResult<{ items: unknown[]; nextPageToken?: string }>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const result = await ytListPlaylists(tokens.accessToken, channelId, opts);
    return { data: result };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to list playlists", suggestion: "Try again later", status: 500 } };
  }
}

// ── create_playlist ──────────────────────────────────────────

export async function createPlaylist(
  channelId: string,
  userId: string,
  opts: { title: string; description?: string; privacyStatus?: string }
): Promise<ServiceResult<unknown>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const playlist = await ytCreatePlaylist(tokens.accessToken, opts.title, opts.description, opts.privacyStatus);
    return { data: playlist };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to create playlist", suggestion: "Try again later", status: 500 } };
  }
}

// ── get_playlist ─────────────────────────────────────────────

export async function getPlaylist(
  playlistId: string,
  channelId: string,
  userId: string
): Promise<ServiceResult<unknown>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const playlist = await ytGetPlaylist(tokens.accessToken, playlistId);
    if (!playlist) {
      return { error: { code: "PLAYLIST_NOT_FOUND", message: "Playlist not found", suggestion: "Check the playlist ID is correct", status: 404 } };
    }
    return { data: playlist };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to get playlist", suggestion: "Try again later", status: 500 } };
  }
}

// ── update_playlist ──────────────────────────────────────────

export async function updatePlaylist(
  playlistId: string,
  channelId: string,
  userId: string,
  updates: { title?: string; description?: string; privacyStatus?: string }
): Promise<ServiceResult<unknown>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    // Prefetch current playlist to merge updates
    const current = await ytGetPlaylist(tokens.accessToken, playlistId);
    if (!current) {
      return { error: { code: "PLAYLIST_NOT_FOUND", message: "Playlist not found", suggestion: "Check the playlist ID is correct", status: 404 } };
    }

    const mergedBody = {
      snippet: {
        title: updates.title ?? current.snippet.title,
        description: updates.description ?? current.snippet.description,
      },
      status: {
        privacyStatus: updates.privacyStatus ?? current.status.privacyStatus,
      },
    };

    const updated = await ytUpdatePlaylist(tokens.accessToken, playlistId, mergedBody);
    return { data: updated };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to update playlist", suggestion: "Try again later", status: 500 } };
  }
}

// ── delete_playlist ──────────────────────────────────────────

export async function deletePlaylist(
  playlistId: string,
  channelId: string,
  userId: string
): Promise<ServiceResult<{ deleted: true }>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    await ytDeletePlaylist(tokens.accessToken, playlistId);
    return { data: { deleted: true } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to delete playlist", suggestion: "Try again later", status: 500 } };
  }
}

// ── list_playlist_items ──────────────────────────────────────

export async function listPlaylistItems(
  playlistId: string,
  channelId: string,
  userId: string,
  opts: { maxResults?: number; pageToken?: string } = {}
): Promise<ServiceResult<{ items: unknown[]; nextPageToken?: string }>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const result = await ytListPlaylistItems(tokens.accessToken, playlistId, opts);
    return { data: result };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to list playlist items", suggestion: "Try again later", status: 500 } };
  }
}

// ── add_playlist_item ────────────────────────────────────────

export async function addPlaylistItem(
  playlistId: string,
  channelId: string,
  userId: string,
  videoId: string
): Promise<ServiceResult<unknown>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const item = await ytAddPlaylistItem(tokens.accessToken, playlistId, videoId);
    return { data: item };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to add playlist item", suggestion: "Try again later", status: 500 } };
  }
}

// ── delete_playlist_item ─────────────────────────────────────

export async function deletePlaylistItem(
  itemId: string,
  channelId: string,
  userId: string
): Promise<ServiceResult<{ deleted: true }>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    await ytDeletePlaylistItem(tokens.accessToken, itemId);
    return { data: { deleted: true } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to delete playlist item", suggestion: "Try again later", status: 500 } };
  }
}
