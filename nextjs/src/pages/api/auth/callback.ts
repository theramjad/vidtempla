/**
 * Supabase Auth OAuth callback handler
 * Handles the OAuth callback and exchanges the code for a session
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import createClient from '@/utils/supabase/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, error, error_description } = req.query;

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error, error_description);
      return res.redirect(
        '/sign-in?error=' + encodeURIComponent(error as string) +
        '&error_description=' + encodeURIComponent(error_description as string || 'Unknown error')
      );
    }

    if (!code || typeof code !== 'string') {
      return res.redirect('/sign-in?error=no_code');
    }

    // Create Supabase client
    const supabase = createClient(req, res);

    // Exchange code for session
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Error exchanging code for session:', exchangeError);
      return res.redirect(
        '/sign-in?error=' + encodeURIComponent(exchangeError.message)
      );
    }

    if (!data.session) {
      return res.redirect('/sign-in?error=no_session');
    }

    // Check if there's a 'next' parameter to redirect to
    const next = req.query.next as string || '/dashboard';

    // Make sure 'next' is a relative URL to prevent open redirect
    const redirectUrl = next.startsWith('/') ? next : '/dashboard';

    // Redirect to the dashboard or specified page
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return res.redirect(
      '/sign-in?error=' +
        encodeURIComponent(
          error instanceof Error ? error.message : 'Unknown error'
        )
    );
  }
}
