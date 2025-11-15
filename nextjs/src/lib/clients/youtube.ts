/**
 * YouTube Data API v3 client
 * Handles OAuth flow and API interactions
 */

import axios from 'axios';

const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface YouTubeChannel {
  id: string;
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

interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
  };
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

  const response = await axios.post<OAuthTokenResponse>(
    YOUTUBE_TOKEN_URL,
    {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
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

  const response = await axios.post<OAuthTokenResponse>(
    YOUTUBE_TOKEN_URL,
    {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data;
}

/**
 * Fetches channel information for the authenticated user
 */
export async function fetchChannelInfo(
  accessToken: string
): Promise<YouTubeChannel> {
  const response = await axios.get<{ items: YouTubeChannel[] }>(
    `${YOUTUBE_API_BASE}/channels`,
    {
      params: {
        part: 'snippet,statistics',
        mine: true,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.data.items || response.data.items.length === 0) {
    throw new Error('No channel found for this account');
  }

  return response.data.items[0];
}

/**
 * Fetches all videos from a channel with pagination
 */
export async function fetchChannelVideos(
  channelId: string,
  accessToken: string,
  pageToken?: string
): Promise<{ videos: YouTubeVideo[]; nextPageToken?: string }> {
  const response = await axios.get<{
    items: YouTubeVideo[];
    nextPageToken?: string;
  }>(`${YOUTUBE_API_BASE}/search`, {
    params: {
      part: 'snippet',
      channelId,
      type: 'video',
      maxResults: 50,
      pageToken,
      order: 'date',
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // Fetch full video details including description
  const videoIds = response.data.items.map((item) => item.id).join(',');

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
