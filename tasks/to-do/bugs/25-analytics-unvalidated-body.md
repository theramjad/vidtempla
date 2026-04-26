# 25: `analytics/query` accepts unvalidated body via `as { ... }` cast

- **Severity:** 🟡 Medium
- **Verified:** Claude exploratory ✓ · Claude verifier ✓ · Codex gpt-5.5 ✓

## Files
- `nextjs/src/app/api/v1/analytics/query/route.ts:9-48`

## Bug
TypeScript-only body shape, no Zod. `body = await request.json()` then `body as { ... }` cast at line 39. `metrics`, `dimensions`, `sort`, `maxResults`, `startDate`, `endDate` all unvalidated (only a regex check on date format downstream).

## Impact
- Garbage forwarded to YouTube Analytics returns opaque 400s
- Negative or huge `maxResults` can crash downstream
- `metrics` / `dimensions` arrays of wrong type cause runtime errors instead of 400 validation failures
- 500s where 400s belong

## Fix
Zod schema, parse before use:

```ts
const QuerySchema = z.object({
  channelId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  metrics: z.array(z.string()).min(1).max(10),
  dimensions: z.array(z.string()).optional(),
  sort: z.string().optional(),
  filters: z.string().optional(),
  maxResults: z.number().int().positive().max(1000).optional(),
}).refine((d) => d.startDate <= d.endDate, { message: "startDate must be <= endDate" });

const parsed = QuerySchema.safeParse(await request.json());
if (!parsed.success) {
  return NextResponse.json(apiError("VALIDATION_ERROR", parsed.error.message,
    "Check field types and ranges", 400), { status: 400 });
}
```
