/**
 * YouTube Data API v3 client
 * Handles OAuth flow and API interactions
 *
 * Note: Uses custom type definitions instead of the googleapis package
 * to avoid the large bundle size (198 MB). These types match the official
 * YouTube API responses for the specific endpoints this app uses.
 */

import axios from 'axios';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { youtubeChannels } from '@/db/schema';
import { decrypt, encrypt } from '@/utils/encryption';

const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2';

/**
 * Custom type for OAuth 2.0 token response
 * Matches Google's standard OAuth token format
 */
interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Custom types for YouTube channel resource
 * Subsets of official API response with commonly used fields
 */
interface YouTubeChannelBase {
  id: string;
}

interface YouTubeChannelSnippetStats extends YouTubeChannelBase {
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default: { url: string };
      medium: { url: string };
      high: { url: string };
    };
  };
  statistics: {
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
  };
}

interface YouTubeChannelContentDetails extends YouTubeChannelBase {
  contentDetails: {
    relatedPlaylists: {
      uploads: string;
    };
  };
}

// Used where we request `snippet,statistics,contentDetails`
type YouTubeChannelFull = YouTubeChannelSnippetStats & YouTubeChannelContentDetails;

/**
 * Custom type for YouTube video resource
 * Subset of official API response with commonly used fields
 */
interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
  };
}

/**
 * Resolves a YouTube channel identifier to a UC... channel ID.
 * Accepts: UC... ID, @handle, or full YouTube URL (youtube.com/@handle, youtube.com/channel/UC...).
 * If already a UC... ID, returns as-is (no API call).
 * Quota cost: 1 unit (only when resolution is needed)
 */
export async function resolveChannelId(
  input: string,
  accessToken: string
): Promise<string> {
  const trimmed = input.trim();

  // Already a UC... channel ID
  if (/^UC[\w-]{22}$/.test(trimmed)) {
    return trimmed;
  }

  // Extract handle or channel ID from URL
  let handle: string | undefined;

  try {
    const url = new URL(trimmed);
    if (url.hostname.replace('www.', '').endsWith('youtube.com')) {
      const pathParts = url.pathname.split('/').filter(Boolean);
      // youtube.com/channel/UC...
      if (pathParts[0] === 'channel' && pathParts[1] && /^UC[\w-]{22}$/.test(pathParts[1])) {
        return pathParts[1];
      }
      // youtube.com/@handle
      if (pathParts[0]?.startsWith('@')) {
        handle = pathParts[0];
      }
    }
  } catch {
    // Not a URL — treat as @handle
  }

  // Bare @handle
  if (!handle && trimmed.startsWith('@')) {
    handle = trimmed;
  }

  if (!handle) {
    throw new Error(
      `Cannot resolve channel identifier "${trimmed}". Expected a UC... channel ID, @handle, or YouTube channel URL.`
    );
  }

  // Strip leading @ for the API call
  const forHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  const response = await axios.get<{ items: { id: string }[] }>(
    `${YOUTUBE_API_BASE}/channels`,
    {
      params: {
        part: 'id',
        forHandle,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const channelId = response.data.items?.[0]?.id;
  if (!channelId) {
    throw new Error(`No YouTube channel found for handle @${forHandle}`);
  }

  return channelId;
}

/**
 * Generates OAuth authorization URL for YouTube
 */
export function getOAuthUrl(): string {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error('YouTube OAuth credentials not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });

  return `${YOUTUBE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchanges authorization code for access and refresh tokens
 */
export async function exchangeCodeForTokens(
  code: string
): Promise<OAuthTokenResponse> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('YouTube OAuth credentials not configured');
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  try {
    const response = await axios.post<OAuthTokenResponse>(
      YOUTUBE_TOKEN_URL,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('OAuth token exchange error:', error.response.data);
      throw new Error(`OAuth failed: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Refreshes an expired access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<OAuthTokenResponse> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('YouTube OAuth credentials not configured');
  }

  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  try {
    const response = await axios.post<OAuthTokenResponse>(
      YOUTUBE_TOKEN_URL,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const errorData = error.response?.data;
      const errorMessage = errorData?.error_description || errorData?.error || 'Unknown error';

      console.error('Token refresh error:', {
        status,
        error: errorData,
        message: error.message,
      });

      throw new Error(
        `Failed to refresh access token (status ${status}): ${errorMessage}. ` +
        `This usually means the refresh token is invalid or revoked. ` +
        `Error details: ${JSON.stringify(errorData)}`
      );
    }
    throw error;
  }
}

export async function getChannelAccessToken(channelId: string): Promise<string> {
  const [channel] = await db
    .select({
      id: youtubeChannels.id,
      channelId: youtubeChannels.channelId,
      title: youtubeChannels.title,
      accessTokenEncrypted: youtubeChannels.accessTokenEncrypted,
      refreshTokenEncrypted: youtubeChannels.refreshTokenEncrypted,
      tokenExpiresAt: youtubeChannels.tokenExpiresAt,
    })
    .from(youtubeChannels)
    .where(eq(youtubeChannels.id, channelId));

  if (!channel?.accessTokenEncrypted || !channel.refreshTokenEncrypted) {
    throw new Error('Channel tokens not found');
  }

  const accessToken = decrypt(channel.accessTokenEncrypted);
  const expiresAt = channel.tokenExpiresAt ? new Date(channel.tokenExpiresAt) : null;
  const now = new Date();
  const bufferTime = 5 * 60 * 1000;

  if (!expiresAt || expiresAt.getTime() - now.getTime() >= bufferTime) {
    return accessToken;
  }

  const refreshToken = decrypt(channel.refreshTokenEncrypted);
  const newTokens = await refreshAccessToken(refreshToken);
  const newExpiresAt = new Date();
  newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newTokens.expires_in);

  await db
    .update(youtubeChannels)
    .set({
      accessTokenEncrypted: encrypt(newTokens.access_token),
      tokenExpiresAt: newExpiresAt,
      tokenStatus: 'valid',
    })
    .where(eq(youtubeChannels.id, channel.id));

  return newTokens.access_token;
}

/**
 * Fetches channel information for the authenticated user
 */
export async function fetchChannelInfo(
  accessToken: string
): Promise<YouTubeChannelFull> {
  try {
    const response = await axios.get<{ items: YouTubeChannelFull[] }>(
      `${YOUTUBE_API_BASE}/channels`,
      {
        params: {
          part: 'snippet,statistics,contentDetails',
          mine: true,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.data || !response.data.items || response.data.items.length === 0) {
      console.error('Unexpected API response:', response.data);
      throw new Error('No channel found for this account');
    }

    const channel = response.data.items[0];
    if (!channel) {
      throw new Error('No channel found for this account');
    }

    return channel;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      console.error('YouTube API error fetching channel info:', error.response.data);
      throw new Error(`YouTube API error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * Gets the uploads playlist ID for a channel
 * This is needed to fetch all videos including private/unlisted ones
 */
export async function getUploadsPlaylistId(
  channelId: string,
  accessToken: string
): Promise<string> {
  const response = await axios.get<{ items: YouTubeChannelContentDetails[] }>(
    `${YOUTUBE_API_BASE}/channels`,
    {
      params: {
        part: 'contentDetails',
        id: channelId,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const uploadsPlaylistId = response.data.items[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    throw new Error('Could not find uploads playlist for channel');
  }

  return uploadsPlaylistId;
}

/**
 * Fetches all videos from a channel with pagination using PlaylistItems API
 * This approach gets ALL videos including private and unlisted ones, with no 500 result limit
 */
export async function fetchChannelVideos(
  channelId: string,
  accessToken: string,
  pageToken?: string,
  uploadsPlaylistId?: string
): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string }> {
  // Get the uploads playlist ID if not provided
  const playlistId = uploadsPlaylistId || await getUploadsPlaylistId(channelId, accessToken);

  // Fetch videos from the uploads playlist
  const response = await axios.get<{
    items: Array<{
      contentDetails: { videoId: string };
      snippet: { title: string; description: string; publishedAt: string };
    }>;
    nextPageToken?: string;
  }>(`${YOUTUBE_API_BASE}/playlistItems`, {
    params: {
      part: 'contentDetails,snippet',
      playlistId,
      maxResults: 50,
      pageToken,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // Fetch full video details including complete description
  const videoIds = response.data.items.map((item) => item.contentDetails.videoId).join(',');

  if (!videoIds) {
    return {
      videos: [],
      nextPageToken: response.data.nextPageToken,
    };
  }

  const detailsResponse = await axios.get<{ items: YouTubeVideo[] }>(
    `${YOUTUBE_API_BASE}/videos`,
    {
      params: {
        part: 'snippet',
        id: videoIds,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return {
    videos: detailsResponse.data.items,
    nextPageToken: response.data.nextPageToken,
  };
}

/**
 * Updates a video's description
 */
export async function updateVideoDescription(
  videoId: string,
  description: string,
  accessToken: string
): Promise<void> {
  // First, fetch current video details
  const videoResponse = await axios.get<{ items: YouTubeVideo[] }>(
    `${YOUTUBE_API_BASE}/videos`,
    {
      params: {
        part: 'snippet',
        id: videoId,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!videoResponse.data.items || videoResponse.data.items.length === 0) {
    throw new Error(`Video ${videoId} not found`);
  }

  const video = videoResponse.data.items[0];
  if (!video) {
    throw new Error(`Video ${videoId} not found`);
  }

  // Update the description
  await axios.put(
    `${YOUTUBE_API_BASE}/videos`,
    {
      id: videoId,
      snippet: {
        ...video.snippet,
        description,
        categoryId: '22', // Default category, you might want to preserve original
      },
    },
    {
      params: {
        part: 'snippet',
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Batch updates multiple video descriptions
 */
export async function batchUpdateDescriptions(
  updates: Array<{ videoId: string; description: string }>,
  accessToken: string
): Promise<{ successful: string[]; failed: Array<{ videoId: string; error: string }> }> {
  const successful: string[] = [];
  const failed: Array<{ videoId: string; error: string }> = [];

  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async ({ videoId, description }) => {
        try {
          await updateVideoDescription(videoId, description, accessToken);
          successful.push(videoId);
        } catch (error) {
          failed.push({
            videoId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    // Add delay between batches to respect rate limits
    if (i + batchSize < updates.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return { successful, failed };
}

// ─── YouTube Captions API functions ───────────────────────────────────

export interface YouTubeCaptionTrack {
  id: string;
  snippet: {
    videoId: string;
    lastUpdated: string;
    trackKind: string;
    language: string;
    name: string;
    audioTrackType: string;
    isCC: boolean;
    isLarge: boolean;
    isEasyReader: boolean;
    isDraft: boolean;
    isAutoSynced: boolean;
    status: string;
  };
}

/**
 * Lists available caption tracks for a video.
 * Quota cost: 50 units
 */
export async function listCaptionTracks(
  accessToken: string,
  videoId: string
): Promise<YouTubeCaptionTrack[]> {
  const response = await axios.get<{ items: YouTubeCaptionTrack[] }>(
    `${YOUTUBE_API_BASE}/captions`,
    {
      params: {
        part: 'snippet',
        videoId,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data.items || [];
}

/**
 * Downloads a caption track's content.
 * Quota cost: 200 units
 * @param tfmt - Format: 'srt' (default), 'vtt', or 'sbv'
 */
export async function downloadCaptionTrack(
  accessToken: string,
  captionId: string,
  tfmt: string = 'srt'
): Promise<string> {
  const response = await axios.get<string>(
    `${YOUTUBE_API_BASE}/captions/${captionId}`,
    {
      params: { tfmt },
      headers: { Authorization: `Bearer ${accessToken}` },
      responseType: 'text',
    }
  );

  return response.data;
}

// ─── YouTube Caption write functions ──────────────────────────────────

/**
 * Uploads a new caption track to a video.
 * Quota cost: 400 units
 */
export async function insertCaptionTrack(
  accessToken: string,
  videoId: string,
  language: string,
  name: string,
  captionData: string,
  isDraft: boolean = false,
  sync: boolean = false
): Promise<YouTubeCaptionTrack> {
  const boundary = `caption_boundary_${Date.now()}`;
  const metadata = JSON.stringify({
    snippet: { videoId, language, name, isDraft },
  });

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: text/plain',
    '',
    captionData,
    `--${boundary}--`,
  ].join('\r\n');

  const params: Record<string, string> = {
    uploadType: 'multipart',
    part: 'snippet',
  };
  if (sync) params.sync = 'true';

  const response = await axios.post<YouTubeCaptionTrack>(
    'https://www.googleapis.com/upload/youtube/v3/captions',
    body,
    {
      params,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
    }
  );

  return response.data;
}

/**
 * Updates an existing caption track (content and/or metadata).
 * Quota cost: 450 units
 */
export async function updateCaptionTrack(
  accessToken: string,
  captionId: string,
  captionData?: string,
  isDraft?: boolean
): Promise<YouTubeCaptionTrack> {
  if (captionData !== undefined) {
    // Multipart upload with new caption content
    const boundary = `caption_boundary_${Date.now()}`;
    const snippet: Record<string, unknown> = {};
    if (isDraft !== undefined) snippet.isDraft = isDraft;

    const metadata = JSON.stringify({ id: captionId, snippet });

    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: text/plain',
      '',
      captionData,
      `--${boundary}--`,
    ].join('\r\n');

    const response = await axios.put<YouTubeCaptionTrack>(
      'https://www.googleapis.com/upload/youtube/v3/captions',
      body,
      {
        params: { uploadType: 'multipart', part: 'snippet' },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
      }
    );

    return response.data;
  }

  // Metadata-only update (e.g. isDraft)
  const response = await axios.put<YouTubeCaptionTrack>(
    `${YOUTUBE_API_BASE}/captions`,
    { id: captionId, snippet: { isDraft } },
    {
      params: { part: 'snippet' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Deletes a caption track.
 * Quota cost: 50 units
 */
export async function deleteCaptionTrack(
  accessToken: string,
  captionId: string
): Promise<void> {
  await axios.delete(`${YOUTUBE_API_BASE}/captions`, {
    params: { id: captionId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ─── YouTube Comments API functions ──────────────────────────────────

export interface YouTubeCommentThread {
  id: string;
  snippet: {
    videoId: string;
    topLevelComment: {
      id: string;
      snippet: {
        textDisplay: string;
        textOriginal: string;
        authorDisplayName: string;
        authorProfileImageUrl: string;
        likeCount: number;
        publishedAt: string;
        updatedAt: string;
      };
    };
    totalReplyCount: number;
    isPublic: boolean;
  };
  replies?: {
    comments: Array<{
      id: string;
      snippet: {
        textDisplay: string;
        textOriginal: string;
        authorDisplayName: string;
        authorProfileImageUrl: string;
        likeCount: number;
        publishedAt: string;
        updatedAt: string;
        parentId: string;
      };
    }>;
  };
}

export interface YouTubeComment {
  id: string;
  snippet: {
    textDisplay: string;
    textOriginal: string;
    authorDisplayName: string;
    parentId: string;
    publishedAt: string;
  };
}

/**
 * Lists comment threads for a video.
 * Quota cost: 1 unit
 */
export async function listCommentThreads(
  accessToken: string,
  videoId: string,
  opts: { maxResults?: number; order?: string; pageToken?: string } = {}
): Promise<{ items: YouTubeCommentThread[]; nextPageToken?: string }> {
  const response = await axios.get<{ items: YouTubeCommentThread[]; nextPageToken?: string }>(
    `${YOUTUBE_API_BASE}/commentThreads`,
    {
      params: {
        part: 'snippet,replies',
        videoId,
        maxResults: opts.maxResults ?? 20,
        order: opts.order ?? 'relevance',
        ...(opts.pageToken && { pageToken: opts.pageToken }),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return { items: response.data.items || [], nextPageToken: response.data.nextPageToken };
}

/**
 * Posts a reply to a comment.
 * Quota cost: 50 units
 */
export async function replyToComment(
  accessToken: string,
  parentId: string,
  text: string
): Promise<YouTubeComment> {
  const response = await axios.post<YouTubeComment>(
    `${YOUTUBE_API_BASE}/comments`,
    { snippet: { parentId, textOriginal: text } },
    {
      params: { part: 'snippet' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Deletes a comment.
 * Quota cost: 50 units
 */
export async function deleteComment(
  accessToken: string,
  commentId: string
): Promise<void> {
  await axios.delete(`${YOUTUBE_API_BASE}/comments`, {
    params: { id: commentId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ─── YouTube Playlists API functions ─────────────────────────────────

export interface YouTubePlaylist {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    thumbnails: Record<string, { url: string; width: number; height: number }>;
  };
  contentDetails: {
    itemCount: number;
  };
  status: {
    privacyStatus: string;
  };
}

export interface YouTubePlaylistItem {
  id: string;
  snippet: {
    title: string;
    description: string;
    playlistId: string;
    position: number;
    resourceId: {
      kind: string;
      videoId: string;
    };
    thumbnails: Record<string, { url: string; width: number; height: number }>;
  };
  contentDetails: {
    videoId: string;
    videoPublishedAt: string;
  };
}

/**
 * Lists playlists for a channel.
 * Quota cost: 1 unit
 */
export async function listPlaylists(
  accessToken: string,
  channelId: string,
  opts: { maxResults?: number; pageToken?: string } = {}
): Promise<{ items: YouTubePlaylist[]; nextPageToken?: string }> {
  const response = await axios.get<{ items: YouTubePlaylist[]; nextPageToken?: string }>(
    `${YOUTUBE_API_BASE}/playlists`,
    {
      params: {
        part: 'snippet,contentDetails,status',
        channelId,
        maxResults: opts.maxResults ?? 25,
        ...(opts.pageToken && { pageToken: opts.pageToken }),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return { items: response.data.items || [], nextPageToken: response.data.nextPageToken };
}

/**
 * Creates a new playlist.
 * Quota cost: 50 units
 */
export async function createPlaylist(
  accessToken: string,
  title: string,
  description?: string,
  privacyStatus: string = 'private'
): Promise<YouTubePlaylist> {
  const response = await axios.post<YouTubePlaylist>(
    `${YOUTUBE_API_BASE}/playlists`,
    {
      snippet: { title, description: description ?? '' },
      status: { privacyStatus },
    },
    {
      params: { part: 'snippet,status' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Gets a single playlist by ID.
 * Quota cost: 1 unit
 */
export async function getPlaylist(
  accessToken: string,
  id: string
): Promise<YouTubePlaylist | null> {
  const response = await axios.get<{ items: YouTubePlaylist[] }>(
    `${YOUTUBE_API_BASE}/playlists`,
    {
      params: {
        part: 'snippet,contentDetails,status',
        id,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data.items?.[0] ?? null;
}

/**
 * Updates a playlist (receives already-merged body).
 * Quota cost: 50 units
 */
export async function updatePlaylist(
  accessToken: string,
  id: string,
  mergedBody: { snippet: Record<string, unknown>; status?: Record<string, unknown> }
): Promise<YouTubePlaylist> {
  const response = await axios.put<YouTubePlaylist>(
    `${YOUTUBE_API_BASE}/playlists`,
    { id, ...mergedBody },
    {
      params: { part: 'snippet,status' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Deletes a playlist.
 * Quota cost: 50 units
 */
export async function deletePlaylist(
  accessToken: string,
  id: string
): Promise<void> {
  await axios.delete(`${YOUTUBE_API_BASE}/playlists`, {
    params: { id },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Lists items in a playlist.
 * Quota cost: 1 unit
 */
export async function listPlaylistItems(
  accessToken: string,
  playlistId: string,
  opts: { maxResults?: number; pageToken?: string } = {}
): Promise<{ items: YouTubePlaylistItem[]; nextPageToken?: string }> {
  const response = await axios.get<{ items: YouTubePlaylistItem[]; nextPageToken?: string }>(
    `${YOUTUBE_API_BASE}/playlistItems`,
    {
      params: {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: opts.maxResults ?? 25,
        ...(opts.pageToken && { pageToken: opts.pageToken }),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return { items: response.data.items || [], nextPageToken: response.data.nextPageToken };
}

/**
 * Adds a video to a playlist.
 * Quota cost: 50 units
 */
export async function addPlaylistItem(
  accessToken: string,
  playlistId: string,
  videoId: string
): Promise<YouTubePlaylistItem> {
  const response = await axios.post<YouTubePlaylistItem>(
    `${YOUTUBE_API_BASE}/playlistItems`,
    {
      snippet: {
        playlistId,
        resourceId: { kind: 'youtube#video', videoId },
      },
    },
    {
      params: { part: 'snippet' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
}

/**
 * Removes an item from a playlist.
 * Quota cost: 50 units
 */
export async function deletePlaylistItem(
  accessToken: string,
  itemId: string
): Promise<void> {
  await axios.delete(`${YOUTUBE_API_BASE}/playlistItems`, {
    params: { id: itemId },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ─── YouTube Analytics API functions ──────────────────────────────────

export interface AnalyticsReportResponse {
  kind: string;
  columnHeaders: Array<{
    name: string;
    columnType: string;
    dataType: string;
  }>;
  rows: Array<Array<string | number>>;
}

export interface AnalyticsQueryParams {
  ids: string;
  startDate: string;
  endDate: string;
  metrics: string;
  dimensions?: string;
  filters?: string;
  sort?: string;
  maxResults?: number;
}

/**
 * Fetches channel-level analytics from the YouTube Analytics API
 */
export async function fetchChannelAnalytics(
  accessToken: string,
  channelId: string,
  metrics: string,
  dimensions: string,
  startDate: string,
  endDate: string,
  filters?: string,
  sort?: string,
  maxResults?: number
): Promise<AnalyticsReportResponse> {
  const params: Record<string, string | number> = {
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics,
    dimensions,
  };
  if (filters) params.filters = filters;
  if (sort) params.sort = sort;
  if (maxResults) params.maxResults = maxResults;

  const response = await axios.get<AnalyticsReportResponse>(
    `${YOUTUBE_ANALYTICS_BASE}/reports`,
    {
      params,
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data;
}

/**
 * Fetches video-level analytics from the YouTube Analytics API
 */
export async function fetchVideoAnalytics(
  accessToken: string,
  videoId: string,
  metrics: string,
  dimensions: string,
  startDate: string,
  endDate: string
): Promise<AnalyticsReportResponse> {
  const response = await axios.get<AnalyticsReportResponse>(
    `${YOUTUBE_ANALYTICS_BASE}/reports`,
    {
      params: {
        ids: `channel==MINE`,
        startDate,
        endDate,
        metrics,
        dimensions,
        filters: `video==${videoId}`,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data;
}

/**
 * Fetches audience retention data for a video using elapsedVideoTimeRatio
 */
export async function fetchVideoRetention(
  accessToken: string,
  videoId: string
): Promise<AnalyticsReportResponse> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const response = await axios.get<AnalyticsReportResponse>(
    `${YOUTUBE_ANALYTICS_BASE}/reports`,
    {
      params: {
        ids: `channel==MINE`,
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
        metrics: 'audienceWatchRatio,relativeRetentionPerformance',
        dimensions: 'elapsedVideoTimeRatio',
        filters: `video==${videoId}`,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data;
}

/**
 * Raw pass-through for flexible YouTube Analytics queries
 */
export async function queryAnalytics(
  accessToken: string,
  params: AnalyticsQueryParams
): Promise<AnalyticsReportResponse> {
  const response = await axios.get<AnalyticsReportResponse>(
    `${YOUTUBE_ANALYTICS_BASE}/reports`,
    {
      params,
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data;
}

// ─── YouTube Data API proxy functions ─────────────────────────────────

export interface YouTubeVideoDetails {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    channelId: string;
    tags?: string[];
    categoryId: string;
    thumbnails: Record<string, { url: string; width: number; height: number }>;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    commentCount: string;
  };
  contentDetails: {
    duration: string;
    definition: string;
    caption: string;
  };
  status: {
    uploadStatus: string;
    privacyStatus: string;
    publishAt?: string;
    embeddable: boolean;
  };
}

export interface YouTubeChannelDetails {
  id: string;
  snippet: {
    title: string;
    description: string;
    customUrl: string;
    publishedAt: string;
    thumbnails: Record<string, { url: string; width: number; height: number }>;
    country?: string;
  };
  statistics: {
    viewCount: string;
    subscriberCount: string;
    videoCount: string;
  };
  contentDetails: {
    relatedPlaylists: {
      uploads: string;
    };
  };
  brandingSettings: {
    channel: {
      title: string;
      description: string;
      keywords?: string;
    };
    image?: {
      bannerExternalUrl?: string;
    };
  };
}

/**
 * Fetches detailed video information from the YouTube Data API
 */
export async function fetchVideoDetails(
  accessToken: string,
  videoIds: string[]
): Promise<YouTubeVideoDetails[]> {
  const response = await axios.get<{ items: YouTubeVideoDetails[] }>(
    `${YOUTUBE_API_BASE}/videos`,
    {
      params: {
        part: 'snippet,statistics,contentDetails,status',
        id: videoIds.join(','),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data.items || [];
}

/**
 * Fetches detailed channel information from the YouTube Data API
 */
export async function fetchChannelDetails(
  accessToken: string
): Promise<YouTubeChannelDetails | null> {
  const response = await axios.get<{ items: YouTubeChannelDetails[] }>(
    `${YOUTUBE_API_BASE}/channels`,
    {
      params: {
        part: 'snippet,statistics,contentDetails,brandingSettings',
        mine: true,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  return response.data.items?.[0] || null;
}
