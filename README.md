# VidTempla

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
git clone https://github.com/theramjad/vidtempla.git
cd vidtempla
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

### 5. Install Dependencies and Run

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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

See the [LICENSE.md](./LICENSE.md) file for the full license text.

For more information, visit: https://www.gnu.org/licenses/agpl-3.0.en.html