# 31: `auth/callback.tsx` puts `session` (likely new ref each render) in deps

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ⚠️ partial

## Files
- `nextjs/src/pages/auth/callback.tsx:50`

## Bug
Effect deps include `session` from `authClient.useSession()`. Whether the hook returns a stable reference depends on the library — usually it does NOT (recreates the wrapper object each render). So the effect can re-fire and call `router.push("/org/resolve")` multiple times.

## Impact
- User occasionally lands on `/sign-in` then `/org/resolve` in quick succession
- Possible double-toast on auth completion

## Fix
Depend on stable primitives + a redirect latch:

```ts
const redirectedRef = useRef(false);
useEffect(() => {
  if (!router.isReady || isPending || redirectedRef.current) return;
  if (session?.user?.id) {
    redirectedRef.current = true;
    router.push("/org/resolve");
  } else {
    redirectedRef.current = true;
    router.push("/sign-in");
  }
}, [router.isReady, isPending, session?.user?.id]);
```
