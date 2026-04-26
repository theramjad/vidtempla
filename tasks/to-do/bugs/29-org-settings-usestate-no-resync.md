# 29: Org settings `useState(name)` — no resync on prop change

- **Severity:** 🟡 Medium (mitigated by context-driven remount)
- **Verified:** Claude exploratory ✓ · Claude verifier ⚠️ partial · Codex gpt-5.5 ⚠️ partial

## Files
- `nextjs/src/pages/org/[slug]/organization/settings.tsx:27`
- `nextjs/src/contexts/OrganizationContext.tsx:107` (orgState reset on slug change), `:132` (unmounts children while loading)

## Bug
```ts
const [orgName, setOrgName] = useState(name);  // no useEffect to resync on prop change
```

## Impact
**Mitigated** in practice: `OrganizationContext.tsx:107` sets `orgState(null)` on slug change and `:132` unmounts children while loading, so the component remounts. Bug only fires if active org context flips in-place on this exact route without unmounting.

Defense-in-depth fix still warranted — context behavior is brittle to refactors.

## Fix
Add the resync effect, dirty-guarded so it doesn't stomp user typing:

```ts
const [orgName, setOrgName] = useState(name);
const [isDirty, setIsDirty] = useState(false);
useEffect(() => {
  if (!isDirty) setOrgName(name);
}, [name, isDirty]);

// In the input onChange:
onChange={(e) => { setOrgName(e.target.value); setIsDirty(true); }}
// In the save handler success:
onSuccess: () => setIsDirty(false),
```
