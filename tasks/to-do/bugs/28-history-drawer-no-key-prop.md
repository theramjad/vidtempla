# 28: `HistoryDrawer` rendered without `key` prop — `expandedVersions` leaks across videos

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/components/youtube/VideosTab.tsx:407-414` — renders `<HistoryDrawer videoId={selectedVideo.id} />` without `key`
- `nextjs/src/components/youtube/VideosTab.tsx:396` — sibling `EditVariablesSheet` correctly uses `key={selectedVideo.id}`
- `nextjs/src/components/youtube/HistoryDrawer.tsx:88` — `useState<Set<string>>(new Set())` for `expandedVersions`

## Bug
`HistoryDrawer` is mounted once, then its `videoId` prop changes when the user picks a different video. Internal `expandedVersions` Set state never resets. Same component instance survives the prop change.

## Impact
- Open History for video A, expand version 3
- Close, open History for video B
- Expansion state from A leaks into B's render until re-mount
- Plus brief flash of A's `currentVideo`/`variables` while B loads

## Fix (one-line)
Add the `key` prop, matching how `EditVariablesSheet` does it on line 396:

```diff
- <HistoryDrawer videoId={selectedVideo.id} ... />
+ <HistoryDrawer key={selectedVideo.id} videoId={selectedVideo.id} ... />
```

Or add `useEffect(() => setExpandedVersions(new Set()), [videoId])` inside the component.
