# 30: Settings post-checkout `useEffect` re-entrant — toast can fire twice

- **Severity:** 🟡 Medium (mitigated — not infinite)
- **Verified:** Claude exploratory ✓ · Claude verifier ⚠️ partial · Codex gpt-5.5 ⚠️ partial

## Files
- `nextjs/src/pages/dashboard/settings.tsx:42-50`
- `nextjs/src/pages/org/[slug]/settings.tsx:43-52`

## Bug
```ts
useEffect(() => {
  if (router.query.checkout === "success") {
    toast.success("...");
    router.replace("/dashboard/settings", undefined, { shallow: true });
  }
}, [router]);
```
`router` reference changes on every router update → effect re-runs after `replace`. The `query.checkout === 'success'` guard short-circuits subsequent runs, so it's NOT infinite — but the toast can fire twice if `router` ref flips before the query updates.

## Fix
Depend on stable values + a `handledRef` latch:

```ts
const handledRef = useRef(false);
useEffect(() => {
  if (!router.isReady || handledRef.current) return;
  if (router.query.checkout === "success") {
    handledRef.current = true;
    toast.success("Subscription activated!");
    router.replace(router.pathname, undefined, { shallow: true });
  }
}, [router.isReady, router.query.checkout]);
```
