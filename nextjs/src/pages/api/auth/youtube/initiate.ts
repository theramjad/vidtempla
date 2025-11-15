/**
 * YouTube OAuth initiation endpoint
 * Redirects user to Google OAuth consent screen
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { getOAuthUrl } from '@/lib/clients/youtube';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authUrl = getOAuthUrl();
    return res.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating YouTube OAuth:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
