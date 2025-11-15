# YouTube Description Updater - Implementation Plan

## Project Overview

Transform this admin dashboard template into a YouTube description management application where users can:
- Link multiple YouTube channels via OAuth
- Import videos and save current descriptions
- Create containers with templates containing variables (using `{{variable_name}}` syntax)
- Mass update video descriptions based on template + variable combinations
- Track version history and rollback changes

## Requirements Summary

### Key Constraints
- Videos can only belong to ONE container
- Templates can appear in MULTIPLE containers
- Variables are defined within templates using `{{variable_name}}` syntax
- Variables are NOT a separate database model - they're parsed from templates
- Containers reference templates using `[[template_name]]` syntax
- Variable values are unique per video (e.g., each video can have its own coupon code)
- When a template updates, ALL videos using that template (via containers) must update
- When a variable updates, ONLY that specific video updates
- Container assignment is immutable - users cannot change which container a video belongs to
- Updates should be batch processed
- Version history with rollback capability (rollback creates new version)
- OAuth authentication with YouTube
- No real-time sync - periodic polling for new videos
- Videos deleted from YouTube should be deleted from the app

## Implementation Checklist

### Phase 1: Database Schema & Types

- [ ] **Create schema file: `supabase/schemas/03_youtube_channels.sql`**
  - [ ] Table: `youtube_channels`
    - id (uuid primary key)
    - user_id (uuid, foreign key to auth.users)
    - channel_id (text, unique, YouTube channel ID)
    - title (text)
    - thumbnail_url (text)
    - subscriber_count (integer)
    - access_token_encrypted (text) - encrypted OAuth access token
    - refresh_token_encrypted (text) - encrypted OAuth refresh token
    - token_expires_at (timestamptz)
    - last_synced_at (timestamptz)
    - created_at (timestamptz, default now())
    - updated_at (timestamptz, default now())
  - [ ] Indexes: user_id, channel_id
  - [ ] RLS policies: users can only access their own channels
  - [ ] Add update_updated_at trigger

- [ ] **Create schema file: `supabase/schemas/04_containers.sql`**
  - [ ] Table: `containers`
    - id (uuid primary key)
    - user_id (uuid, foreign key to auth.users)
    - name (text, not null)
    - template_order (uuid[], array of template IDs in order)
    - created_at (timestamptz, default now())
    - updated_at (timestamptz, default now())
  - [ ] Indexes: user_id
  - [ ] RLS policies: users can only access their own containers
  - [ ] Add update_updated_at trigger

- [ ] **Create schema file: `supabase/schemas/05_templates.sql`**
  - [ ] Table: `templates`
    - id (uuid primary key)
    - user_id (uuid, foreign key to auth.users)
    - name (text, not null)
    - content (text, contains {{variable}} placeholders)
    - created_at (timestamptz, default now())
    - updated_at (timestamptz, default now())
  - [ ] Indexes: user_id
  - [ ] RLS policies: users can only access their own templates
  - [ ] Add update_updated_at trigger

- [ ] **Create schema file: `supabase/schemas/06_youtube_videos.sql`**
  - [ ] Table: `youtube_videos`
    - id (uuid primary key)
    - channel_id (uuid, foreign key to youtube_channels, on delete cascade)
    - video_id (text, unique, YouTube video ID)
    - title (text)
    - current_description (text)
    - container_id (uuid, foreign key to containers, nullable)
    - published_at (timestamptz)
    - created_at (timestamptz, default now())
    - updated_at (timestamptz, default now())
  - [ ] Indexes: channel_id, container_id, video_id
  - [ ] RLS policies: users can access videos from their channels
  - [ ] Add update_updated_at trigger
  - [ ] Add constraint: container_id cannot be updated once set (check constraint or trigger)

- [ ] **Create schema file: `supabase/schemas/07_video_variables.sql`**
  - [ ] Table: `video_variables`
    - id (uuid primary key)
    - video_id (uuid, foreign key to youtube_videos, on delete cascade)
    - template_id (uuid, foreign key to templates, on delete cascade)
    - variable_name (text, not null)
    - variable_value (text)
    - variable_type (text, check in: 'text', 'number', 'date', 'url')
    - created_at (timestamptz, default now())
    - updated_at (timestamptz, default now())
  - [ ] Unique constraint: (video_id, template_id, variable_name)
  - [ ] Indexes: video_id, template_id
  - [ ] RLS policies: users can access variables for their videos
  - [ ] Add update_updated_at trigger

- [ ] **Create schema file: `supabase/schemas/08_description_history.sql`**
  - [ ] Table: `description_history`
    - id (uuid primary key)
    - video_id (uuid, foreign key to youtube_videos, on delete cascade)
    - description (text, not null)
    - version_number (integer, not null)
    - created_at (timestamptz, default now())
    - created_by (uuid, foreign key to auth.users)
  - [ ] Indexes: (video_id, created_at DESC), (video_id, version_number)
  - [ ] RLS policies: users can view history for their videos
  - [ ] Add function to auto-increment version_number per video

- [ ] **Generate migration from schema files**
  - Run: `cd supabase && supabase db diff -f youtube_description_updater_init`

- [ ] **Apply migration locally**
  - Run: `cd supabase && supabase migration up`

- [ ] **Regenerate TypeScript types**
  - Run: `npx supabase gen types typescript --local > shared-types/database.types.ts`

### Phase 2: YouTube OAuth & API Integration

- [ ] **Set up Google Cloud Project**
  - [ ] Create project at console.cloud.google.com
  - [ ] Enable YouTube Data API v3
  - [ ] Create OAuth 2.0 credentials (Web application)
  - [ ] Add authorized redirect URI: `http://localhost:3000/api/auth/youtube/callback`
  - [ ] Note client ID and client secret

- [ ] **Add environment variables**
  - [ ] Update `.env.example` with YouTube OAuth vars
  - [ ] Add to `.env.local`:
    - `YOUTUBE_CLIENT_ID=`
    - `YOUTUBE_CLIENT_SECRET=`
    - `YOUTUBE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback`
    - `ENCRYPTION_KEY=` (for token encryption)

- [ ] **Create YouTube API client: `nextjs/src/lib/clients/youtube.ts`**
  - [ ] Function: `getOAuthUrl()` - Generate OAuth authorization URL
  - [ ] Function: `exchangeCodeForTokens(code)` - Exchange auth code for tokens
  - [ ] Function: `refreshAccessToken(refreshToken)` - Refresh expired access token
  - [ ] Function: `fetchChannelInfo(accessToken)` - Get channel details
  - [ ] Function: `fetchChannelVideos(channelId, accessToken, pageToken?)` - Fetch videos with pagination
  - [ ] Function: `updateVideoDescription(videoId, description, accessToken)` - Update single video
  - [ ] Function: `batchUpdateDescriptions(updates[])` - Batch update multiple videos

- [ ] **Create encryption utilities: `nextjs/src/utils/encryption.ts`**
  - [ ] Function: `encrypt(text)` - Encrypt tokens before storing
  - [ ] Function: `decrypt(encryptedText)` - Decrypt tokens when using
  - [ ] Use crypto library with AES-256-GCM

- [ ] **Create OAuth callback route: `nextjs/src/pages/api/auth/youtube/callback.ts`**
  - [ ] Handle OAuth callback with code parameter
  - [ ] Exchange code for access + refresh tokens
  - [ ] Fetch channel info
  - [ ] Encrypt tokens
  - [ ] Store in youtube_channels table
  - [ ] Redirect to /admin/youtube/channels

- [ ] **Create OAuth initiate route: `nextjs/src/pages/api/auth/youtube/initiate.ts`**
  - [ ] Generate OAuth URL
  - [ ] Redirect user to Google OAuth consent screen

### Phase 3: Template Parser Utility

- [ ] **Create template parser: `nextjs/src/utils/templateParser.ts`**
  - [ ] Function: `parseVariables(content: string): string[]`
    - Extract all `{{variable_name}}` occurrences
    - Return unique variable names
  - [ ] Function: `replaceVariables(content: string, variables: Record<string, string>): string`
    - Replace all `{{var}}` with corresponding values
    - Handle missing variables (leave as {{var}} or show error)
  - [ ] Function: `buildDescription(templates: Template[], variables: VideoVariable[]): string`
    - Concatenate templates in order (from template_order array)
    - Replace all variables with video-specific values
    - Return final description string
  - [ ] Add unit tests for parser functions

### Phase 4: tRPC API Routes

- [ ] **Create YouTube router: `nextjs/src/server/api/routers/admin/youtube.ts`**

- [ ] **Channel Management Procedures**
  - [ ] `channels.list` (query)
    - Return all youtube_channels for current user
    - Order by created_at DESC
  - [ ] `channels.initiateOAuth` (mutation)
    - Return OAuth URL for user to visit
  - [ ] `channels.disconnect` (mutation)
    - Input: `{ channelId: uuid }`
    - Delete channel (cascades to videos, variables, history)
  - [ ] `channels.syncVideos` (mutation)
    - Input: `{ channelId: uuid }`
    - Trigger Inngest event to fetch videos
    - Return job ID for status tracking

- [ ] **Container Management Procedures**
  - [ ] `containers.list` (query)
    - Return all containers for current user
    - Include template count and assigned video count
  - [ ] `containers.create` (mutation)
    - Input: `{ name: string, templateIds: uuid[] }`
    - Create container with template_order array
  - [ ] `containers.update` (mutation)
    - Input: `{ id: uuid, name?: string, templateIds?: uuid[] }`
    - Update container
    - Trigger Inngest event to update all videos in this container
  - [ ] `containers.delete` (mutation)
    - Input: `{ id: uuid }`
    - Check if videos are assigned (prevent deletion or cascade)
    - Delete container

- [ ] **Template Management Procedures**
  - [ ] `templates.list` (query)
    - Return all templates for current user
    - Include variable count and container usage count
  - [ ] `templates.create` (mutation)
    - Input: `{ name: string, content: string }`
    - Parse variables from content
    - Create template
  - [ ] `templates.update` (mutation)
    - Input: `{ id: uuid, name?: string, content?: string }`
    - Update template
    - Trigger Inngest event to update all videos using this template
  - [ ] `templates.delete` (mutation)
    - Input: `{ id: uuid }`
    - Check if used in containers (prevent deletion or cascade)
    - Delete template
  - [ ] `templates.parseVariables` (query)
    - Input: `{ content: string }`
    - Return array of detected variable names
    - Used for live preview in UI

- [ ] **Video Management Procedures**
  - [ ] `videos.list` (query)
    - Input: `{ channelId?: uuid, containerId?: uuid, search?: string }`
    - Return videos with filters
    - Include container info, variable counts
  - [ ] `videos.unassigned` (query)
    - Return all videos with container_id = null
  - [ ] `videos.assignToContainer` (mutation)
    - Input: `{ videoId: uuid, containerId: uuid }`
    - Check video is not already assigned (immutable)
    - Assign video to container
    - Initialize variables for all templates in container
  - [ ] `videos.getVariables` (query)
    - Input: `{ videoId: uuid }`
    - Return all variables for this video grouped by template
  - [ ] `videos.updateVariables` (mutation)
    - Input: `{ videoId: uuid, variables: { templateId, name, value, type }[] }`
    - Upsert video_variables records
    - Trigger Inngest event to update this video's description
  - [ ] `videos.preview` (query)
    - Input: `{ videoId: uuid }`
    - Get container → templates → variables
    - Build final description using templateParser
    - Return preview string
  - [ ] `videos.getHistory` (query)
    - Input: `{ videoId: uuid }`
    - Return all description_history entries
    - Order by version_number DESC
  - [ ] `videos.rollback` (mutation)
    - Input: `{ videoId: uuid, historyId: uuid }`
    - Get description from history entry
    - Create new history entry (version_number = max + 1)
    - Update video description in YouTube
    - Update current_description in database

- [ ] **Update the admin router to include youtube router**
  - Edit: `nextjs/src/server/api/routers/admin.ts`
  - Add: `youtube: youtubeRouter`

### Phase 5: Background Jobs with Inngest

- [ ] **Update Inngest event types: `nextjs/src/inngest/types.ts`**
  - [ ] Add event: `youtube/channel.sync` with channelId
  - [ ] Add event: `youtube/videos.update` with videoIds[]
  - [ ] Add event: `youtube/container.updated` with containerId
  - [ ] Add event: `youtube/template.updated` with templateId

- [ ] **Create sync function: `nextjs/src/inngest/youtube/syncChannelVideos.ts`**
  - [ ] Listen to: `youtube/channel.sync`
  - [ ] Step 1: Fetch channel from database, decrypt tokens
  - [ ] Step 2: Check if access token expired, refresh if needed
  - [ ] Step 3: Fetch all videos from YouTube (handle pagination)
  - [ ] Step 4: For each video:
    - Check if exists in database (by video_id)
    - If new: insert with current description as version 1 in history
    - If exists: update title, published_at (don't change description)
  - [ ] Step 5: Detect deleted videos (in DB but not in YouTube response)
    - Delete from database
  - [ ] Step 6: Update last_synced_at on channel

- [ ] **Create update function: `nextjs/src/inngest/youtube/updateVideoDescriptions.ts`**
  - [ ] Listen to: `youtube/videos.update`, `youtube/container.updated`, `youtube/template.updated`
  - [ ] Step 1: Determine which videos to update based on event type
  - [ ] Step 2: For each video (batch by 50):
    - Get container → templates → variables
    - Build description using templateParser
    - Compare with current_description (skip if unchanged)
  - [ ] Step 3: Batch update YouTube (handle rate limits)
  - [ ] Step 4: For each successful update:
    - Update current_description in database
    - Create new description_history entry
  - [ ] Step 5: Handle errors (log failures, don't fail entire batch)

- [ ] **Create scheduled sync: `nextjs/src/inngest/youtube/scheduledSync.ts`**
  - [ ] Cron: Every 6 hours
  - [ ] Fetch all youtube_channels
  - [ ] Trigger `youtube/channel.sync` for each channel

- [ ] **Register functions in: `nextjs/src/pages/api/inngest.ts`**
  - [ ] Add: syncChannelVideos
  - [ ] Add: updateVideoDescriptions
  - [ ] Add: scheduledSync

### Phase 6: UI Components - Channels

- [ ] **Create ChannelsTab component: `nextjs/src/components/youtube/ChannelsTab.tsx`**
  - [ ] "Connect YouTube Channel" button
    - Calls `channels.initiateOAuth`
    - Opens OAuth URL in new window
  - [ ] Table with columns:
    - Thumbnail (avatar)
    - Channel name
    - Subscriber count
    - Last synced
    - Actions: "Sync Now" button, Delete button
  - [ ] Delete confirmation dialog (AlertDialog)
  - [ ] Sync button triggers `channels.syncVideos`
  - [ ] Toast notifications for success/error
  - [ ] Use tRPC hooks: `api.admin.youtube.channels.list`, etc.

### Phase 7: UI Components - Templates

- [ ] **Create TemplatesTab component: `nextjs/src/components/youtube/TemplatesTab.tsx`**
  - [ ] "Create Template" form:
    - Name input
    - Content textarea (large, with monospace font)
    - Syntax help text showing `{{variable_name}}` format
    - Live preview section showing detected variables
  - [ ] Table with columns:
    - Template name
    - Variable count (e.g., "3 variables: {{coupon}}, {{link}}, {{price}}")
    - Used in X containers
    - Actions: Edit, Delete
  - [ ] Edit modal:
    - Shows which containers use this template
    - Warning: "Updating will trigger updates for X videos"
    - Name and content fields
  - [ ] Delete confirmation with usage warning
  - [ ] Use tRPC hooks: `api.admin.youtube.templates.*`
  - [ ] Real-time variable parsing with `templates.parseVariables`

### Phase 8: UI Components - Containers

- [ ] **Create ContainersTab component: `nextjs/src/components/youtube/ContainersTab.tsx`**
  - [ ] "Create Container" form:
    - Name input
    - Multi-select for templates (with drag-to-reorder)
    - Preview showing template order with arrows
  - [ ] Table with columns:
    - Container name
    - Template count (e.g., "3 templates")
    - Assigned videos count
    - Actions: Edit, Delete
  - [ ] Edit modal:
    - Update name
    - Reorder templates (drag-and-drop using Radix UI)
    - Warning: "Updating will trigger updates for X videos"
  - [ ] Delete confirmation (warn if videos assigned)
  - [ ] Use tRPC hooks: `api.admin.youtube.containers.*`

### Phase 9: UI Components - Videos

- [ ] **Create VideosTab component: `nextjs/src/components/youtube/VideosTab.tsx`**
  - [ ] Filters section:
    - Channel selector dropdown
    - Container filter dropdown (with "Unassigned" option)
    - Search input (by title)
  - [ ] Table with columns:
    - Thumbnail
    - Video title
    - Container (badge, or "Unassigned")
    - Last updated
    - Actions: Assign (if unassigned), Edit Variables, Preview, History
  - [ ] Assign to Container dialog:
    - Container selector
    - Warning: "This is permanent and cannot be changed"
    - Confirm button
  - [ ] Edit Variables modal:
    - Show all variables from container's templates
    - Grouped by template
    - Input for each variable (with type validation)
    - Save button (triggers update)
  - [ ] Preview modal:
    - Shows final description (read-only textarea)
    - "Update YouTube" button
    - Shows last updated timestamp
  - [ ] Use tRPC hooks: `api.admin.youtube.videos.*`

- [ ] **Create VariableQuickEdit component: `nextjs/src/components/youtube/VariableQuickEdit.tsx`**
  - [ ] Table-based bulk editor (inspired by diagram)
  - [ ] Columns: Video title + one column per variable
  - [ ] Inline editing (editable cells)
  - [ ] Auto-save on blur or manual "Save All" button
  - [ ] Filter by container
  - [ ] Use tRPC: `videos.list`, `videos.updateVariables`

- [ ] **Create HistoryDrawer component: `nextjs/src/components/youtube/HistoryDrawer.tsx`**
  - [ ] Sheet/Drawer showing version timeline
  - [ ] Each version shows:
    - Version number
    - Created at timestamp
    - Created by user
    - Description preview (expandable)
  - [ ] "Rollback to this version" button
  - [ ] Diff view comparing versions (optional, nice-to-have)
  - [ ] Use tRPC: `videos.getHistory`, `videos.rollback`

### Phase 10: Main YouTube Page

- [ ] **Create main YouTube page: `nextjs/src/pages/admin/youtube/index.tsx`**
  - [ ] Use DashboardLayout wrapper
  - [ ] Tabs component with 4 tabs:
    - Channels
    - Templates
    - Containers
    - Videos
  - [ ] Import and render tab components
  - [ ] Proper spacing and container styling

### Phase 11: Navigation & Configuration

- [ ] **Update app config: `nextjs/src/config/app.ts`**
  - [ ] Change `defaultRoute` to `/admin/youtube`
  - [ ] Update navigation array:
    ```typescript
    navigation: [
      {
        title: "YouTube Manager",
        subItems: [
          { title: "Dashboard", url: "/admin/youtube" },
        ],
      },
      {
        title: "Settings",
        url: "/admin/settings",
      },
    ]
    ```

- [ ] **Update `.env.example`**
  - [ ] Add all YouTube-related environment variables
  - [ ] Add comments explaining each variable
  - [ ] Remove Twitter-related variables (or keep if still needed)

### Phase 12: Testing & Refinement

- [ ] **Database Testing**
  - [ ] Test all foreign key cascades
  - [ ] Test RLS policies with different users
  - [ ] Test container assignment immutability constraint
  - [ ] Test version history auto-increment

- [ ] **API Testing**
  - [ ] Test OAuth flow end-to-end
  - [ ] Test video sync with mock YouTube data
  - [ ] Test description update with real YouTube API
  - [ ] Test batch updates with multiple videos
  - [ ] Test rollback creates new version correctly

- [ ] **Template Parser Testing**
  - [ ] Test variable extraction with edge cases
  - [ ] Test variable replacement with missing vars
  - [ ] Test description building with multiple templates
  - [ ] Test with special characters in variables

- [ ] **UI Testing**
  - [ ] Test all forms with validation
  - [ ] Test error states and loading states
  - [ ] Test responsive design on mobile
  - [ ] Test toast notifications
  - [ ] Test modals and dialogs

- [ ] **Integration Testing**
  - [ ] Complete flow: Connect channel → Sync videos → Create template → Create container → Assign video → Update variables → Preview → Update YouTube
  - [ ] Test template update triggering video updates
  - [ ] Test container update triggering video updates
  - [ ] Test rollback functionality
  - [ ] Test deletion cascades

- [ ] **Error Handling**
  - [ ] Handle YouTube API quota exceeded
  - [ ] Handle expired OAuth tokens (auto-refresh)
  - [ ] Handle deleted YouTube videos
  - [ ] Handle network failures gracefully
  - [ ] Show user-friendly error messages

- [ ] **Performance Optimization**
  - [ ] Add pagination to video lists
  - [ ] Optimize database queries (use indexes)
  - [ ] Batch YouTube API calls efficiently
  - [ ] Add loading skeletons for better UX

### Phase 13: Documentation

- [ ] **Update README**
  - [ ] Add project description
  - [ ] Add setup instructions for YouTube OAuth
  - [ ] Add instructions for running migrations
  - [ ] Add environment variable documentation

- [ ] **Update CLAUDE.md**
  - [ ] Document new database schema
  - [ ] Document template syntax and variable system
  - [ ] Document YouTube API integration
  - [ ] Document update triggering logic

- [ ] **Code Comments**
  - [ ] Add JSDoc comments to all utility functions
  - [ ] Add comments explaining complex logic
  - [ ] Add TODO comments for future enhancements

## Future Enhancements (Not in MVP)

- [ ] Conditional logic in templates (if/else statements)
- [ ] Nested/hierarchical templates (template inheritance)
- [ ] Computed variables (derived from other variables)
- [ ] Real-time sync with YouTube webhooks
- [ ] Advanced filtering and search for videos
- [ ] Export/import templates and containers
- [ ] Duplicate container functionality
- [ ] Analytics on update success rates
- [ ] Scheduled updates (update descriptions at specific times)
- [ ] A/B testing for descriptions

## Notes for Continuation

### Current State
This project is based on an admin dashboard template with:
- Next.js 15, TypeScript, Tailwind CSS, Radix UI
- Supabase for database and auth
- tRPC for type-safe APIs
- Inngest for background jobs
- Email-based admin access control

### Key Files to Reference
- Database schemas: `supabase/schemas/*.sql`
- tRPC routers: `nextjs/src/server/api/routers/admin/*.ts`
- UI components: `nextjs/src/components/**/*.tsx`
- Inngest functions: `nextjs/src/inngest/**/*.ts`
- App config: `nextjs/src/config/app.ts`

### Migration Workflow
1. Edit schema files in `supabase/schemas/`
2. Generate migration: `cd supabase && supabase db diff -f <name>`
3. Apply locally: `cd supabase && supabase migration up`
4. Generate types: `npx supabase gen types typescript --local > shared-types/database.types.ts`
5. Never apply to remote server - prompt user to do manually

### Variable System Architecture
- Variables are NOT a separate table - they're parsed from template content
- Template content contains `{{variable_name}}` placeholders
- `video_variables` table stores the VALUES for each video+template+variable combination
- When building a description:
  1. Get container → get template_order array
  2. For each template ID in order → get template content
  3. Get all video_variables for this video+template
  4. Replace `{{var}}` with values from video_variables
  5. Concatenate all processed templates

### Update Trigger Logic
- Variable update → Update ONLY that video
- Template update → Update ALL videos in containers that reference this template
- Container update → Update ALL videos assigned to this container

### Authentication
- Admin access controlled by email list in `nextjs/src/config/app.ts`
- YouTube OAuth tokens stored encrypted in database
- Token refresh handled automatically before API calls
