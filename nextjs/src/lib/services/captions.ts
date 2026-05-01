import { getChannelTokens, resolveVideo, videoNotFoundError } from "@/lib/api-auth";
import {
  listCaptionTracks,
  downloadCaptionTrack,
  insertCaptionTrack,
  updateCaptionTrack,
  deleteCaptionTrack,
} from "@/lib/clients/youtube";
import { srtToPlainText } from "@/utils/srtParser";
import type { ServiceResult } from "./types";

// ── list_video_captions ──────────────────────────────────────

export interface CaptionTrackInfo {
  id: string;
  language: string;
  trackKind: string;
  name: string;
  isAutoSynced: boolean;
}

export async function listVideoCaptions(
  videoId: string,
  userId: string,
  organizationId?: string
): Promise<ServiceResult<CaptionTrackInfo[]>> {
  try {
    const videoResult = await resolveVideo(videoId, userId, organizationId);
    if (!videoResult.found) {
      return { error: videoNotFoundError(videoResult.reason) };
    }
    const video = videoResult.video;

    const tokens = await getChannelTokens(video.channelYoutubeId, userId, organizationId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const tracks = await listCaptionTracks(tokens.accessToken, video.videoId);

    return {
      data: tracks.map((t) => ({
        id: t.id,
        language: t.snippet.language,
        trackKind: t.snippet.trackKind,
        name: t.snippet.name,
        isAutoSynced: t.snippet.isAutoSynced,
      })),
    };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to list captions", suggestion: "Try again later", status: 500 } };
  }
}

// ── get_video_transcript ─────────────────────────────────────

export interface TranscriptOpts {
  captionId?: string;
  language?: string;
  format?: "text" | "srt" | "vtt";
}

export interface TranscriptResult {
  transcript: string;
  captionId: string;
  language: string;
  trackKind: string;
  format: string;
  quotaUnits: number;
}

export async function getVideoTranscript(
  videoId: string,
  userId: string,
  opts: TranscriptOpts = {},
  organizationId?: string
): Promise<ServiceResult<TranscriptResult>> {
  try {
    const videoResult = await resolveVideo(videoId, userId, organizationId);
    if (!videoResult.found) {
      return { error: videoNotFoundError(videoResult.reason) };
    }
    const video = videoResult.video;

    const tokens = await getChannelTokens(video.channelYoutubeId, userId, organizationId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const format = opts.format ?? "text";
    let captionId = opts.captionId;
    let language = "";
    let trackKind = "";
    let quotaUnits = 200;

    if (!captionId) {
      // Auto-select: list tracks first (adds 50 quota units)
      const tracks = await listCaptionTracks(tokens.accessToken, video.videoId);
      quotaUnits = 250;

      if (tracks.length === 0) {
        return { error: { code: "NO_CAPTIONS", message: "No caption tracks found for this video", suggestion: "This video may not have captions available", status: 404 } };
      }

      // Prefer manual tracks over ASR, respect language filter
      let selected = tracks;
      if (opts.language) {
        selected = tracks.filter((t) => t.snippet.language === opts.language);
        if (selected.length === 0) {
          return {
            error: {
              code: "LANGUAGE_NOT_FOUND",
              message: `No caption track found for language: ${opts.language}`,
              suggestion: `Available languages: ${tracks.map((t) => t.snippet.language).join(", ")}`,
              status: 404,
            },
          };
        }
      }

      // Sort: manual tracks first, then ASR
      const sorted = [...selected].sort((a, b) => {
        if (a.snippet.trackKind === "standard" && b.snippet.trackKind !== "standard") return -1;
        if (a.snippet.trackKind !== "standard" && b.snippet.trackKind === "standard") return 1;
        return 0;
      });

      const track = sorted[0]!;
      captionId = track.id;
      language = track.snippet.language;
      trackKind = track.snippet.trackKind;
    }

    // Download the caption track
    const tfmt = format === "text" ? "srt" : format;
    const raw = await downloadCaptionTrack(tokens.accessToken, captionId, tfmt);

    const transcript = format === "text" ? srtToPlainText(raw) : raw;

    // If we had a captionId from the caller, we still need language/trackKind
    if (opts.captionId && (!language || !trackKind)) {
      language = "unknown";
      trackKind = "unknown";
    }

    return {
      data: {
        transcript,
        captionId,
        language,
        trackKind,
        format,
        quotaUnits,
      },
    };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to download transcript", suggestion: "Try again later", status: 500 } };
  }
}

// ── insert_caption ───────────────────────────────────────────

export async function insertCaption(
  videoId: string,
  userId: string,
  opts: { language: string; name: string; captionData: string; isDraft?: boolean; sync?: boolean },
  organizationId?: string
): Promise<ServiceResult<CaptionTrackInfo>> {
  try {
    const videoResult = await resolveVideo(videoId, userId, organizationId);
    if (!videoResult.found) {
      return { error: videoNotFoundError(videoResult.reason) };
    }
    const video = videoResult.video;

    const tokens = await getChannelTokens(video.channelYoutubeId, userId, organizationId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const track = await insertCaptionTrack(
      tokens.accessToken, video.videoId, opts.language, opts.name, opts.captionData, opts.isDraft, opts.sync
    );

    return {
      data: {
        id: track.id,
        language: track.snippet.language,
        trackKind: track.snippet.trackKind,
        name: track.snippet.name,
        isAutoSynced: track.snippet.isAutoSynced,
      },
    };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to upload caption", suggestion: "Try again later", status: 500 } };
  }
}

// ── update_caption ───────────────────────────────────────────

export async function updateCaption(
  videoId: string,
  userId: string,
  captionId: string,
  opts: { captionData?: string; isDraft?: boolean },
  organizationId?: string
): Promise<ServiceResult<CaptionTrackInfo>> {
  try {
    const videoResult = await resolveVideo(videoId, userId, organizationId);
    if (!videoResult.found) {
      return { error: videoNotFoundError(videoResult.reason) };
    }
    const video = videoResult.video;

    const tokens = await getChannelTokens(video.channelYoutubeId, userId, organizationId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    const track = await updateCaptionTrack(tokens.accessToken, captionId, opts.captionData, opts.isDraft);

    return {
      data: {
        id: track.id,
        language: track.snippet.language,
        trackKind: track.snippet.trackKind,
        name: track.snippet.name,
        isAutoSynced: track.snippet.isAutoSynced,
      },
    };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to update caption", suggestion: "Try again later", status: 500 } };
  }
}

// ── delete_caption ───────────────────────────────────────────

export async function deleteCaption(
  videoId: string,
  userId: string,
  captionId: string,
  organizationId?: string
): Promise<ServiceResult<{ deleted: true }>> {
  try {
    const videoResult = await resolveVideo(videoId, userId, organizationId);
    if (!videoResult.found) {
      return { error: videoNotFoundError(videoResult.reason) };
    }
    const video = videoResult.video;

    const tokens = await getChannelTokens(video.channelYoutubeId, userId, organizationId);
    if ("error" in tokens) {
      return { error: { code: tokens.error.error.code, message: tokens.error.error.message, suggestion: tokens.error.error.suggestion ?? "", status: tokens.status } };
    }

    await deleteCaptionTrack(tokens.accessToken, captionId);
    return { data: { deleted: true } };
  } catch {
    return { error: { code: "INTERNAL_ERROR", message: "Failed to delete caption", suggestion: "Try again later", status: 500 } };
  }
}
