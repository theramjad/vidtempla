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

/**
 * Translates an upstream YouTube Data API failure into VidTempla's standard
 * REST envelope, inspecting `error.response.data.error.errors[].reason` so
 * agents can distinguish quota exhaustion from permission failures.
 *
 * Mapping:
 *  - reason `quotaExceeded` / `dailyLimitExceeded` / `rateLimitExceeded`
 *      -> `QUOTA_EXCEEDED` / 429
 *  - upstream HTTP 404 -> `NOT_FOUND` / 404
 *  - upstream HTTP 403 -> `FORBIDDEN` / 403
 *  - everything else   -> `YOUTUBE_API_ERROR` / upstream status (or 500)
 */
export function mapYouTubeError(err: unknown): MappedYouTubeError {
  // Pull a typed view of the axios error payload, falling back gracefully
  // for non-axios errors (e.g. network failures, programmer errors).
  const axiosErr = axios.isAxiosError<YouTubeErrorPayload>(err) ? err : null;
  const payload = axiosErr?.response?.data;
  const reason = payload?.error?.errors?.[0]?.reason;
  const status = axiosErr?.response?.status ?? 500;
  const message =
    payload?.error?.message ??
    (err instanceof Error ? err.message : undefined) ??
    "YouTube API error";

  if (
    reason === "quotaExceeded" ||
    reason === "dailyLimitExceeded" ||
    reason === "rateLimitExceeded"
  ) {
    return {
      body: apiError(
        "QUOTA_EXCEEDED",
        "YouTube API quota exhausted",
        "Wait for daily quota reset (Pacific midnight) or contact support.",
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
