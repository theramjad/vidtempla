import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, apiRequestLog, youtubeChannels } from "@/db/schema";
import { hashApiKey } from "@/lib/api-keys";
import { decrypt } from "@/utils/encryption";
import { refreshAccessToken } from "@/lib/clients/youtube";
import { encrypt } from "@/utils/encryption";

export interface ApiContext {
  userId: string;
  apiKeyId: string;
}

/**
 * Authenticates a request using a Bearer API key.
 * Returns ApiContext on success, or a NextResponse error on failure.
 */
export async function withApiKey(
  request: NextRequest
): Promise<ApiContext | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      apiError(
        "MISSING_API_KEY",
        "Authorization header with Bearer token is required",
        "Include header: Authorization: Bearer vtk_your_key",
        401
      ),
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  if (!token.startsWith("vtk_")) {
    return NextResponse.json(
      apiError(
        "INVALID_API_KEY",
        "API key must start with vtk_",
        "Generate a new key from Settings > API Keys",
        401
      ),
      { status: 401 }
    );
  }

  const keyHash = hashApiKey(token);

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash));

  if (!key) {
    return NextResponse.json(
      apiError(
        "INVALID_API_KEY",
        "API key not found or has been revoked",
        "Generate a new key from Settings > API Keys",
        401
      ),
      { status: 401 }
    );
  }

  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return NextResponse.json(
      apiError(
        "API_KEY_EXPIRED",
        "This API key has expired",
        "Generate a new key from Settings > API Keys",
        401
      ),
      { status: 401 }
    );
  }

  // Fire-and-forget: update lastUsedAt
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))
    .then(() => {})
    .catch(() => {});

  return { userId: key.userId, apiKeyId: key.id };
}

/**
 * Logs an API request to the apiRequestLog table (fire-and-forget).
 */
export function logRequest(
  ctx: ApiContext,
  endpoint: string,
  method: string,
  statusCode: number,
  quotaUnits: number = 0
): void {
  db.insert(apiRequestLog)
    .values({
      apiKeyId: ctx.apiKeyId,
      userId: ctx.userId,
      endpoint,
      method,
      statusCode,
      quotaUnits,
    })
    .then(() => {})
    .catch((err) => {
      console.error("Failed to log API request:", err);
    });
}

/**
 * Standard success response envelope.
 */
export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return {
    data,
    error: null,
    ...(meta && { meta }),
  };
}

/**
 * Standard error response envelope.
 */
export function apiError(
  code: string,
  message: string,
  suggestion?: string,
  status: number = 400
) {
  return {
    data: null,
    error: {
      code,
      message,
      suggestion,
      status,
    },
  };
}

/**
 * Fetches a channel's OAuth tokens, decrypts them, and refreshes if expired.
 * Follows the same pattern as syncChannelVideos.ts.
 * Returns { accessToken, channelId } or an error response body.
 */
export async function getChannelTokens(
  channelId: string,
  userId: string
): Promise<
  | { accessToken: string; channelId: string }
  | { error: ReturnType<typeof apiError>; status: number }
> {
  const [channel] = await db
    .select()
    .from(youtubeChannels)
    .where(
      and(
        eq(youtubeChannels.channelId, channelId),
        eq(youtubeChannels.userId, userId)
      )
    );

  if (!channel) {
    return {
      error: apiError(
        "CHANNEL_NOT_FOUND",
        "Channel not found or not connected to your account",
        "Connect a YouTube channel from the dashboard first",
        404
      ),
      status: 404,
    };
  }

  if (!channel.accessTokenEncrypted || !channel.refreshTokenEncrypted) {
    return {
      error: apiError(
        "CHANNEL_NO_TOKENS",
        "Channel OAuth tokens are missing",
        "Reconnect your YouTube channel from the dashboard",
        400
      ),
      status: 400,
    };
  }

  if (channel.tokenStatus === "invalid") {
    return {
      error: apiError(
        "CHANNEL_TOKEN_INVALID",
        "Channel OAuth token has been revoked or expired",
        "Reconnect your YouTube channel from the dashboard",
        401
      ),
      status: 401,
    };
  }

  let accessToken = decrypt(channel.accessTokenEncrypted);
  const expiresAt = channel.tokenExpiresAt
    ? new Date(channel.tokenExpiresAt)
    : null;
  const now = new Date();
  const bufferTime = 5 * 60 * 1000; // 5 minutes

  // Refresh if expired or about to expire
  if (expiresAt && expiresAt.getTime() - now.getTime() < bufferTime) {
    const refreshToken = decrypt(channel.refreshTokenEncrypted);

    try {
      const newTokens = await refreshAccessToken(refreshToken);

      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(
        newExpiresAt.getSeconds() + newTokens.expires_in
      );

      await db
        .update(youtubeChannels)
        .set({
          accessTokenEncrypted: encrypt(newTokens.access_token),
          tokenExpiresAt: newExpiresAt,
        })
        .where(eq(youtubeChannels.id, channel.id));

      accessToken = newTokens.access_token;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      const isTokenError =
        errorMessage.includes("invalid_grant") ||
        errorMessage.includes("Token has been expired or revoked") ||
        errorMessage.includes("status 400");

      if (isTokenError) {
        await db
          .update(youtubeChannels)
          .set({ tokenStatus: "invalid" })
          .where(eq(youtubeChannels.id, channel.id));

        return {
          error: apiError(
            "CHANNEL_TOKEN_INVALID",
            "Channel OAuth token has been revoked. Please reconnect.",
            "Reconnect your YouTube channel from the dashboard",
            401
          ),
          status: 401,
        };
      }

      return {
        error: apiError(
          "TOKEN_REFRESH_FAILED",
          `Failed to refresh access token: ${errorMessage}`,
          "Try again later or reconnect your channel",
          500
        ),
        status: 500,
      };
    }
  }

  return { accessToken, channelId: channel.channelId };
}
