# Video Rollback with Delink Implementation Plan

## Overview
Implement simple version control for video descriptions using existing `description_history` table. When users roll back to a previous version, the video will be delinked from its container and all variables will be cleared.

---

## Background

### Current System
- **`description_history` table** already exists and tracks all description changes
- **Rollback functionality** partially implemented in `nextjs/src/server/api/routers/youtube.ts` (lines ~641-681)
- Videos can be assigned to **containers** which build descriptions from **templates** + **variables**
- Container assignment is **immutable** (can't change once set, but can be set to NULL)

### Key Tables
```sql
youtube_videos:
  - id, channel_id, video_id, title, current_description
  - container_id (nullable, FK to containers) -- Can be set to NULL

description_history:
  - id, video_id, description (text snapshot)
  - version_number, created_at, created_by

video_variables:
  - id, video_id, template_id, variable_name, variable_value
```

---

## What We're Building

### Core Behavior
When user rolls back a video description to a previous version:

1. **Restore exact text** from `description_history` snapshot
2. **Delink from container**: Set `youtube_videos.container_id = NULL`
3. **Clear all variables**: Delete all rows in `video_variables` for this video
4. **Update YouTube**: Trigger Inngest job to push description to YouTube
5. **Create history entry**: New `description_history` row with restored text

### Why Delink?
- If we keep container assignment, next template edit would overwrite the rollback
- Delinking = "user taking manual control" vs. "automated template control"
- User can re-assign to container later if desired (NULL → container is allowed)

---

## Implementation Steps

### Step 1: Update Rollback API Endpoint ✅

**File:** `nextjs/src/server/api/routers/youtube.ts` (around line 641-681)

**Current code structure:**
```typescript
rollback: protectedProcedure
  .input(z.object({ historyId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // 1. Fetch history entry by ID
    // 2. Update youtube_videos.current_description
    // 3. Trigger Inngest job
    // 4. Return success
  });
```

**Changes needed:**
```typescript
rollback: protectedProcedure
  .input(z.object({ historyId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // 1. Fetch history entry
    const history = await ctx.db
      .from('description_history')
      .select('*')
      .eq('id', input.historyId)
      .single();

    // 2. Get current video state (for return metadata)
    const video = await ctx.db
      .from('youtube_videos')
      .select('container_id')
      .eq('id', history.video_id)
      .single();

    const { data: variables } = await ctx.db
      .from('video_variables')
      .select('id')
      .eq('video_id', history.video_id);

    const hadContainer = !!video.container_id;
    const variableCount = variables?.length || 0;

    // 3. DELINK: Set container_id to NULL
    if (hadContainer) {
      await ctx.db
        .from('youtube_videos')
        .update({ container_id: null })
        .eq('id', history.video_id);
    }

    // 4. CLEAR VARIABLES: Delete all video_variables
    if (variableCount > 0) {
      await ctx.db
        .from('video_variables')
        .delete()
        .eq('video_id', history.video_id);
    }

    // 5. Update current_description (existing logic)
    await ctx.db
      .from('youtube_videos')
      .update({ current_description: history.description })
      .eq('id', history.video_id);

    // 6. Trigger Inngest job (existing logic)
    await inngest.send({
      name: "youtube/update.video",
      data: { videoId: history.video_id }
    });

    // 7. Return metadata
    return {
      success: true,
      delinkedContainer: hadContainer,
      variablesCleared: variableCount,
    };
  });
```

**Key points:**
- Use transaction if available to ensure atomicity
- Handle errors gracefully (if YouTube update fails, should we rollback the delink?)
- Return metadata so UI can show what happened

---

### Step 2: Add Confirmation Dialog UI ✅

**File:** `nextjs/src/components/HistoryDrawer.tsx`

**Current behavior:**
- Shows list of description versions
- "Restore" button exists but may not show warnings

**Changes needed:**

1. **Fetch current video state** before showing rollback dialog:
```typescript
const { data: video } = await api.videos.getById.useQuery({ id: videoId });
const { data: variables } = await api.videos.getVariables.useQuery({ videoId });
```

2. **Add AlertDialog confirmation** before triggering rollback:
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="outline" size="sm">
      Restore this version
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Rollback to Version {version.version_number}?</AlertDialogTitle>
      <AlertDialogDescription>
        <p>This will restore the description from {formatDate(version.created_at)}.</p>

        {video?.container_id && (
          <div className="mt-4 space-y-2">
            <p className="font-semibold text-yellow-600">⚠️ Warning:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Video will be removed from its container</li>
              {variableCount > 0 && <li>{variableCount} variable values will be cleared</li>}
              <li>Description will be updated on YouTube</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              You can re-assign to a container later if needed.
            </p>
          </div>
        )}

        {!video?.container_id && (
          <p className="mt-2 text-sm text-muted-foreground">
            The description will be updated on YouTube.
          </p>
        )}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction onClick={() => handleRollback(version.id)}>
        Restore Anyway
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

3. **Update success toast** after rollback:
```typescript
const handleRollback = async (historyId: string) => {
  const result = await rollbackMutation.mutateAsync({ historyId });

  if (result.delinkedContainer) {
    toast.success(
      `Description restored to version ${versionNumber}. Video delinked from container.`
    );
  } else {
    toast.success(`Description restored to version ${versionNumber}.`);
  }
};
```

---

### Step 3: Handle Edge Cases ✅

**Case 1: Video not in container**
- Skip container delink step
- Only show simple confirmation: "Restore this description?"
- No warning about delinking

**Case 2: Video has no variables**
- Skip variable deletion
- Don't mention variables in warning

**Case 3: Video has neither container nor variables**
- Simplest case: just restore description
- Minimal confirmation dialog

**Case 4: Rollback fails (YouTube API error)**
- Options:
  - **Option A:** Rollback the database changes (undo delink/variable clear)
  - **Option B:** Keep database changes, show error about YouTube sync
- **Recommendation:** Use database transaction, rollback everything on failure
- Show error toast: "Failed to update YouTube. Please try again."

**Case 5: Multiple rollbacks in sequence**
- Each rollback creates new history entry
- Container stays NULL after first rollback (subsequent rollbacks don't need to delink)

---

### Step 4: Testing Scenarios ✅

#### Test 1: Standard Rollback (video in container with variables)
1. Create video with container assigned
2. Set 3 variables
3. Update description multiple times (create history)
4. Rollback to version 3
5. **Verify:**
   - ✅ Description matches version 3 text exactly
   - ✅ `container_id` is NULL
   - ✅ All `video_variables` rows deleted
   - ✅ YouTube API called with new description
   - ✅ New `description_history` entry created

#### Test 2: Rollback video without container
1. Create video, don't assign to container
2. Manually update description (creates history)
3. Rollback to previous version
4. **Verify:**
   - ✅ Description restored
   - ✅ No errors (no container to delink)
   - ✅ YouTube updated

#### Test 3: Re-assign after rollback
1. Rollback video (gets delinked)
2. Assign to container again
3. **Verify:**
   - ✅ Container assignment works (immutable trigger allows NULL → container)
   - ✅ Variables re-initialized from templates
   - ✅ Description rebuilt from templates

#### Test 4: Concurrent rollbacks (multiple tabs)
1. Open video in two browser tabs
2. Trigger rollback in both simultaneously
3. **Verify:**
   - ✅ No race conditions
   - ✅ Both complete successfully (or one fails gracefully)

---

## Files to Modify

| File | Changes | Lines |
|------|---------|-------|
| `nextjs/src/server/api/routers/youtube.ts` | Update `videos.rollback` mutation | ~30 lines |
| `nextjs/src/components/HistoryDrawer.tsx` | Add confirmation dialog with warnings | ~60 lines |

---

## Database Schema (No Changes Needed!)

All required tables already exist:

```sql
-- Already exists
description_history (
  id uuid PRIMARY KEY,
  video_id uuid REFERENCES youtube_videos(id),
  description text,
  version_number integer,
  created_at timestamptz,
  created_by uuid
);

-- Already exists
youtube_videos (
  id uuid PRIMARY KEY,
  container_id uuid REFERENCES containers(id) NULL, -- Can be set to NULL
  current_description text,
  ...
);

-- Already exists
video_variables (
  id uuid PRIMARY KEY,
  video_id uuid REFERENCES youtube_videos(id),
  template_id uuid REFERENCES templates(id),
  variable_name text,
  variable_value text
);
```

**Important:** The `prevent_container_reassignment` trigger allows setting `container_id = NULL`. It only prevents changing from one container to another (non-NULL → different non-NULL).

---

## API Endpoints

### Existing (to modify)
```typescript
videos.rollback(historyId: string)
  -> { success: boolean, delinkedContainer: boolean, variablesCleared: number }
```

### May need to add (for UI)
```typescript
videos.getById(id: string)
  -> { id, container_id, ... }

videos.getVariables(videoId: string)
  -> Array<{ id, variable_name, variable_value }>
```

(These might already exist - check `nextjs/src/server/api/routers/youtube.ts`)

---

## Timeline

**Total: 1 day (8 hours)**

- **Hour 1-2:** Update `videos.rollback` mutation with delink logic
- **Hour 3-4:** Build confirmation dialog UI in `HistoryDrawer.tsx`
- **Hour 5-6:** Handle edge cases (no container, no variables, error states)
- **Hour 7-8:** Testing all scenarios, polish UI/UX

---

## Success Criteria

✅ User can rollback video to any previous description version
✅ Video automatically delinked from container on rollback
✅ All variables cleared on rollback
✅ Clear warning shown before rollback (lists what will happen)
✅ YouTube description updated after rollback
✅ New history entry created (preserves audit trail)
✅ No data loss (old history entries preserved)
✅ Can re-assign to container after rollback
✅ Edge cases handled (no container, no variables, errors)

---

## Out of Scope (Not Implementing)

❌ Template versioning (user must manually edit template if they break it)
❌ Container versioning (no rollback for container structure changes)
❌ Variable versioning (no history of variable value changes)
❌ Bulk rollback (can only rollback one video at a time)
❌ Preview before rollback (no diff view of what will change)
❌ "Undo rollback" button (user can rollback to most recent version manually)
❌ Variable value recovery (once cleared, can't get old values back)

---

## User Experience Flow

### Scenario: User accidentally edited description manually and wants to undo

1. User goes to Videos page
2. Clicks video → "View History" button
3. HistoryDrawer opens, shows version list:
   ```
   Version 7 (current) - Nov 18, 2025 3:45 PM - You
   Version 6 - Nov 18, 2025 2:30 PM - You
   Version 5 - Nov 15, 2025 10:00 AM - System
   ```
4. User clicks "Restore this version" on Version 6
5. **AlertDialog appears:**
   ```
   ⚠️ Rollback to Version 6?

   This will restore the description from Nov 18, 2025 2:30 PM.

   Warning:
   • Video will be removed from "Holiday Campaign" container
   • 8 variable values will be cleared
   • Description will be updated on YouTube

   You can re-assign to a container later if needed.

   [Cancel]  [Restore Anyway]
   ```
6. User clicks "Restore Anyway"
7. **Loading state** (spinner on button)
8. **Success toast:** "Description restored to version 6. Video delinked from container."
9. Video page refreshes, shows:
   - Description from version 6
   - No container badge
   - "Assign to container" button available

---

## Notes for Implementation

### Transaction Handling
Wrap all database operations in a transaction to ensure atomicity:
```typescript
await ctx.db.transaction(async (tx) => {
  // 1. Delink container
  // 2. Delete variables
  // 3. Update description
  // 4. If any step fails, rollback all
});
```

### Error Messages
- YouTube API fails: "Failed to update YouTube. Description updated locally."
- Invalid history ID: "Version not found."
- Permission denied: "You don't have permission to rollback this video."

### Performance
- Delinking and variable deletion are simple updates (fast)
- YouTube API is async (handled by Inngest, doesn't block)
- History entry creation is lightweight

### Future Enhancements (if needed later)
- Add "Preview" button to see old description before rollback
- Add "Restore variables too" option (would require variable versioning)
- Add bulk rollback UI (rollback multiple videos at once)
- Add template history view (just audit log, no rollback)
