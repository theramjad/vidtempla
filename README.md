# YouTube Description Manager

A powerful admin dashboard for managing YouTube video descriptions at scale using dynamic templates and variables.

## Features

### Core Functionality
- **Multi-Channel Support**: Connect and manage multiple YouTube channels via OAuth
- **Template System**: Create reusable description templates with `{{variable}}` placeholders
- **Container Management**: Group templates together to create description structures
- **Dynamic Variables**: Set unique variable values per video for personalized descriptions
- **Version History**: Track all description changes with rollback capability
- **Batch Updates**: Update multiple video descriptions simultaneously

### Key Features
- 🔐 Secure OAuth authentication with YouTube
- 📝 Powerful template editor with variable auto-detection
- 🎯 Immutable video-to-container assignment for data integrity
- 📊 Clean, intuitive admin dashboard
- 🔄 Background job processing with Inngest
- 🛡️ Row-level security with Supabase
- 📱 Fully responsive UI

## Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **UI Components**: Radix UI
- **Backend**: tRPC for type-safe APIs
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth + YouTube OAuth
- **Background Jobs**: Inngest
- **API Integration**: YouTube Data API v3

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Google Cloud account (for YouTube API)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/youtube-description-updater.git
cd youtube-description-updater
```

### 2. Set Up Supabase

```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Start local Supabase instance
cd supabase
supabase start
```

The migration files have already been created and will be applied automatically when you run `supabase start`.

### 3. Set Up Google Cloud & YouTube API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the **YouTube Data API v3**
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/youtube/callback`
   - Note your Client ID and Client Secret

### 4. Configure Environment Variables

```bash
cd nextjs
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# YouTube OAuth (from Google Cloud Console)
YOUTUBE_CLIENT_ID=your_google_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_google_oauth_client_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

# Encryption key (generate a random 32+ character string)
ENCRYPTION_KEY=your_random_32_character_encryption_key_here

# Supabase (from `supabase status` command)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Inngest (for local development, use these defaults)
INNGEST_EVENT_KEY=local
INNGEST_SIGNING_KEY=local
```

### 5. Update Admin Email

Edit `nextjs/src/config/app.ts` and add your email to the `adminEmails` array:

```typescript
auth: {
  adminEmails: [
    "your-email@example.com", // Replace with your email
  ],
}
```

### 6. Install Dependencies and Run

```bash
# Install dependencies
cd nextjs
npm install

# Generate database types
npx supabase gen types typescript --local > ../shared-types/database.types.ts

# Start development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

## Usage Guide

### 1. Sign Up / Sign In

- Navigate to the app and sign up with the email you added to `adminEmails`
- Verify your email via the Supabase inbucket at http://localhost:54324

### 2. Connect YouTube Channel

- Go to **Channels** tab
- Click "Connect Channel"
- Authorize with your YouTube account
- Your channel will appear in the list

### 3. Create Templates

- Go to **Templates** tab
- Click "Create Template"
- Write your template using `{{variable_name}}` syntax:

```
Check out this amazing product!

Price: {{price}}
Discount Code: {{coupon_code}}
Product Link: {{product_link}}

Don't miss out!
```

- Variables are auto-detected and displayed

### 4. Create Containers

- Go to **Containers** tab
- Click "Create Container"
- Select templates to include (they'll be concatenated in order)
- A container might include templates like: "Intro" + "Product Details" + "Call to Action"

### 5. Assign Videos to Containers

- Go to **Videos** tab
- Find unassigned videos
- Click "Assign" and select a container
- **Important**: Container assignment is permanent and cannot be changed

### 6. Edit Variables (Coming Soon)

In a future update, you'll be able to:
- Edit variable values for each video
- Preview the final description
- Update YouTube descriptions in bulk
- View version history
- Rollback to previous versions

## Project Structure

```
youtube-description-updater/
├── nextjs/                    # Main Next.js application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ui/           # Radix UI components
│   │   │   ├── layout/       # Layout components
│   │   │   └── youtube/      # YouTube feature components
│   │   ├── config/           # App configuration
│   │   ├── pages/            # Next.js pages
│   │   │   ├── admin/        # Admin pages
│   │   │   └── api/          # API routes
│   │   ├── server/           # tRPC server and routers
│   │   ├── utils/            # Utility functions
│   │   └── lib/              # Library clients (YouTube API)
│   └── package.json
├── shared-types/             # Shared TypeScript types
│   └── database.types.ts     # Generated Supabase types
├── supabase/                # Supabase configuration
│   ├── migrations/          # Database migrations
│   └── schemas/             # Schema definition files
└── PLAN.md                  # Detailed implementation plan
```

## Database Schema

### Core Tables

- **youtube_channels**: Connected YouTube channels with OAuth tokens
- **templates**: Description templates with variables
- **containers**: Collections of templates in specific order
- **youtube_videos**: Video metadata and container assignments
- **video_variables**: Variable values per video-template combination
- **description_history**: Version history for all description changes

### Key Relationships

- Videos belong to ONE container (immutable)
- Containers can have MULTIPLE templates
- Templates can be used in MULTIPLE containers
- Variables are unique per video + template combination

## API Routes

### tRPC Procedures

All API routes are type-safe via tRPC:

- **Channels**: list, initiateOAuth, disconnect, syncVideos
- **Templates**: list, create, update, delete, parseVariables
- **Containers**: list, create, update, delete
- **Videos**: list, unassigned, assignToContainer, getVariables, updateVariables, preview, getHistory, rollback

## Security

- **Admin-Only Access**: All routes protected by email-based admin check
- **Row-Level Security**: Supabase RLS ensures users only see their data
- **Token Encryption**: OAuth tokens encrypted using AES-256-GCM
- **Immutable Assignments**: Container assignments cannot be changed once set

## Development

### Running Migrations

```bash
cd supabase
supabase migration up
```

### Generating Types

```bash
npx supabase gen types typescript --local > ../shared-types/database.types.ts
```

### Adding New Features

1. Update schema files in `supabase/schemas/`
2. Generate migration: `supabase db diff -f migration_name`
3. Apply migration: `supabase migration up`
4. Regenerate types
5. Update tRPC procedures in `nextjs/src/server/api/routers/admin/youtube.ts`
6. Create/update UI components

## Next Steps

The following features are planned for future updates:

- [ ] Variable editing UI with bulk update capability
- [ ] Preview modal showing final description
- [ ] Version history viewer with diff comparison
- [ ] Rollback functionality
- [ ] Inngest background jobs for:
  - Syncing channel videos
  - Updating YouTube descriptions
  - Scheduled periodic syncs
- [ ] Advanced variable types (rich text, dropdowns, etc.)
- [ ] Template inheritance and nesting
- [ ] Conditional logic in templates
- [ ] A/B testing for descriptions
- [ ] Analytics and success tracking

## Troubleshooting

### "Channel tokens not found" error
- Reconnect your YouTube channel
- Check that OAuth tokens are properly encrypted

### Videos not showing up
- Click "Sync Now" on your channel
- Check Supabase logs for errors
- Ensure YouTube API quota is not exceeded

### Type errors after schema changes
- Regenerate TypeScript types: `npx supabase gen types typescript --local > ../shared-types/database.types.ts`
- Restart Next.js dev server

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your own purposes!

## Support

For issues and questions:
- Check the [PLAN.md](./PLAN.md) file for implementation details
- Review the [CLAUDE.md](./CLAUDE.md) file for development guidelines
- Open an issue on GitHub

---

**Built with [Claude Code](https://claude.com/claude-code)**
