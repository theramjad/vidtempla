import axios from "axios";
import { apiError } from "./api-auth";

/**
 * Shape of the YouTube Data API JSON error envelope.
 * Documented at: https://developers.google.com/youtube/v3/docs/errors
 */
interface YouTubeErrorPayload {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{
      reason?: string;
      domain?: string;
      message?: string;
    }>;
  };
}

/**
 * Result returned by mapYouTubeError. Both fields can be passed straight
 * into `NextResponse.json(body, { status })`.
 */
export interface MappedYouTubeError {
  body: ReturnType<typeof apiError>;
  status: number;
}

export interface YouTubeServiceError {
  code: string;
  message: string;
  suggestion: string;
  status: number;
}

const QUOTA_REASONS = new Set([
  "quotaExceeded",
  "dailyLimitExceeded",
  "rateLimitExceeded",
  "userRateLimitExceeded",
]);

/**
 * Translates an upstream YouTube Data API failure into VidTempla's standard
 * REST envelope, inspecting every `error.response.data.error.errors[].reason` so
 * agents can distinguish quota exhaustion from permission failures.
 *
 * Mapping:
 *  - quota/rate-limit reason, or upstream HTTP 429 -> `QUOTA_EXCEEDED` / 429
 *  - upstream HTTP 404 -> `NOT_FOUND` / 404
 *  - upstream HTTP 403 -> `FORBIDDEN` / 403
 *  - everything else   -> `YOUTUBE_API_ERROR` / upstream status (or 500)
 */
export function mapYouTubeError(err: unknown): MappedYouTubeError {
  // Pull a typed view of the axios error payload, falling back gracefully
  // for non-axios errors (e.g. network failures, programmer errors).
  const axiosErr = axios.isAxiosError<YouTubeErrorPayload>(err) ? err : null;
  const payload = axiosErr?.response?.data;
  const reasons =
    payload?.error?.errors
      ?.map((entry) => entry.reason)
      .filter((reason): reason is string => Boolean(reason)) ?? [];
  const status = axiosErr?.response?.status ?? 500;
  const message =
    payload?.error?.message ??
    (err instanceof Error ? err.message : undefined) ??
    "YouTube API error";

  if (status === 429 || reasons.some((reason) => QUOTA_REASONS.has(reason))) {
    return {
      body: apiError(
        "QUOTA_EXCEEDED",
        "YouTube API quota exhausted",
        "Retry with backoff. If daily quota is exhausted, wait for the Pacific midnight reset or contact support.",
        429
      ),
      status: 429,
    };
  }

  if (status === 404) {
    return {
      body: apiError(
        "NOT_FOUND",
        message,
        "Verify the resource ID exists.",
        404
      ),
      status: 404,
    };
  }

  if (status === 403) {
    return {
      body: apiError(
        "FORBIDDEN",
        message,
        "Verify your channel has permission for this action.",
        403
      ),
      status: 403,
    };
  }

  return {
    body: apiError(
      "YOUTUBE_API_ERROR",
      message,
      "Check YouTube API status at status.cloud.google.com.",
      status
    ),
    status,
  };
}

export function mapYouTubeServiceError(err: unknown): YouTubeServiceError {
  const mapped = mapYouTubeError(err);
  const { code, message, suggestion, status } = mapped.body.error;

  return {
    code,
    message,
    suggestion: suggestion ?? "",
    status,
  };
}
