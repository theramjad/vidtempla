# 19: YouTube `invalid_grant` (revoked access) not detected — channel left in 500 loop

- **Severity:** 🟠 High
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/lib/clients/youtube.ts:227-276` — `refreshAccessToken` throws generic Error
- `nextjs/src/lib/clients/youtube.ts:278-319` — `getChannelAccessToken` calls without try/catch
- `nextjs/src/workflows/sync-channel-videos.ts:106-128` — only path that handles invalid_grant

## Bug
`refreshAccessToken` throws `new Error(\`Failed to refresh access token (status ${status}): ...\`)` with no discriminant. `getChannelAccessToken` doesn't catch and never sets `tokenStatus = 'invalid'`. Only the workflow path knows how to handle revoked access.

## Impact
Any v1 API proxy or template-push for a user who revoked YouTube access throws 500 forever — no re-auth prompt, no `tokenStatus` flip, no graceful degradation. Agents see opaque server errors and can't self-correct.

## Fix
Throw a typed OAuth error and catch it in `getChannelAccessToken`:

```ts
class InvalidGrantError extends Error {
  constructor() { super("YouTube refresh token revoked"); }
}

async function refreshAccessToken(refreshToken: string) {
  try { /* ... */ }
  catch (err: any) {
    if (err.response?.data?.error === "invalid_grant") {
      throw new InvalidGrantError();
    }
    throw err;
  }
}

async function getChannelAccessToken(channelId, userId, organizationId?) {
  try {
    const newToken = await refreshAccessToken(channel.refreshToken);
    // ... mark valid
  } catch (err) {
    if (err instanceof InvalidGrantError) {
      await db.update(youtubeChannels).set({ tokenStatus: 'invalid' }).where(...);
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Reconnect YouTube channel' });
    }
    throw err;
  }
}
```

Surface a structured `CHANNEL_DISCONNECTED` code at the API boundary so agents/UI can prompt re-auth.
