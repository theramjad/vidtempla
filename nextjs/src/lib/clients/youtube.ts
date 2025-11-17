/**
 * YouTube Data API v3 client
 * Handles OAuth flow and API interactions
 *
 * Note: Uses custom type definitions instead of the googleapis package
 * to avoid the large bundle size (198 MB). These types match the official
 * YouTube API responses for the specific endpoints this app uses.
 */

import axios from 'axios';

const YOUTUBE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

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
