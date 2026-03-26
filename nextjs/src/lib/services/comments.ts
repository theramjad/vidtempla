import { getChannelTokens } from "@/lib/api-auth";
import {
  listCommentThreads as ytListCommentThreads,
  replyToComment as ytReplyToComment,
  deleteComment as ytDeleteComment,
} from "@/lib/clients/youtube";
import type { ServiceResult } from "./types";

// ── list_comment_threads ─────────────────────────────────────

export async function listCommentThreads(
  videoId: string,
  channelId: string,
  userId: string,
  opts: { maxResults?: number; order?: string; pageToken?: string } = {}
): Promise<ServiceResult<{ items: unknown[]; nextPageToken?: string }>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const result = await ytListCommentThreads(tokens.accessToken, videoId, opts);
    return { data: result };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to list comment threads", suggestion: "Try again later", status: 500 } };
  }
}

// ── reply_to_comment ─────────────────────────────────────────

export async function replyToComment(
  channelId: string,
  parentId: string,
  text: string,
  userId: string
): Promise<ServiceResult<unknown>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const comment = await ytReplyToComment(tokens.accessToken, parentId, text);
    return { data: comment };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to reply to comment", suggestion: "Try again later", status: 500 } };
  }
}

// ── delete_comment ───────────────────────────────────────────

export async function deleteComment(
  channelId: string,
  commentId: string,
  userId: string
): Promise<ServiceResult<{ deleted: true }>> {
  try {
    const tokens = await getChannelTokens(channelId, userId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    await ytDeleteComment(tokens.accessToken, commentId);
    return { data: { deleted: true } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to delete comment", suggestion: "Try again later", status: 500 } };
  }
}
