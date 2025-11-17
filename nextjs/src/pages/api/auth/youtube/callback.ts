/**
 * YouTube OAuth callback handler
 * Exchanges authorization code for tokens and stores channel info
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import createClient from '@/utils/supabase/api';
import {
  exchangeCodeForTokens,
  fetchChannelInfo,
} from '@/lib/clients/youtube';
import { encrypt } from '@/utils/encryption';
import { checkChannelLimit } from '@/lib/plan-limits';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, error } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return res.redirect(
        '/dashboard/youtube?error=' + encodeURIComponent(error as string)
      );
    }

    if (!code || typeof code !== 'string') {
      return res.redirect(
        '/dashboard/youtube?error=no_code'
      );
    }

    // Create Supabase client
    const supabase = createClient(req, res);

    // Get current user
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return res.redirect('/sign-in?redirect=/dashboard/youtube');
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Fetch channel info
    const channelInfo = await fetchChannelInfo(tokens.access_token);

    // Calculate token expiry
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

    // Encrypt tokens
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null;

    // Check if channel already exists
    const { data: existingChannel } = await supabase
      .from('youtube_channels')
      .select('id')
      .eq('channel_id', channelInfo.id)
      .single();

    if (existingChannel) {
      // Update existing channel
      await supabase
        .from('youtube_channels')
        .update({
          access_token_encrypted: encryptedAccessToken,
          refresh_token_encrypted: encryptedRefreshToken,
          token_expires_at: expiresAt.toISOString(),
          title: channelInfo.snippet.title,
          thumbnail_url: channelInfo.snippet.thumbnails.high.url,
          subscriber_count: parseInt(channelInfo.statistics.subscriberCount),
        })
        .eq('id', existingChannel.id);
    } else {
      // Check channel limit before adding a new channel
      const limitCheck = await checkChannelLimit(session.user.id, supabase);

      if (!limitCheck.canAddChannel) {
        return res.redirect(
          `/dashboard/youtube?error=${encodeURIComponent(
            `Channel limit reached (${limitCheck.limit} ${limitCheck.limit === 1 ? 'channel' : 'channels'} on ${limitCheck.planTier} plan). Please upgrade to add more channels.`
          )}`
        );
      }

      // Insert new channel
      await supabase.from('youtube_channels').insert({
        user_id: session.user.id,
        channel_id: channelInfo.id,
        title: channelInfo.snippet.title,
        thumbnail_url: channelInfo.snippet.thumbnails.high.url,
        subscriber_count: parseInt(channelInfo.statistics.subscriberCount),
        access_token_encrypted: encryptedAccessToken,
        refresh_token_encrypted: encryptedRefreshToken,
        token_expires_at: expiresAt.toISOString(),
      });
    }

    // Redirect to YouTube dashboard page with success message
    return res.redirect('/dashboard/youtube?success=true');
  } catch (error) {
    console.error('Error in YouTube OAuth callback:', error);
    return res.redirect(
      '/dashboard/youtube?error=' +
        encodeURIComponent(
          error instanceof Error ? error.message : 'Unknown error'
        )
    );
  }
}
