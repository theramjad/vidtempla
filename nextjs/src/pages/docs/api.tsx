import Head from "next/head";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-lg border bg-muted/50 overflow-hidden">
      {title && (
        <div className="px-4 py-2 border-b bg-muted text-xs font-medium text-muted-foreground">
          {title}
        </div>
      )}
      <pre className="p-4 text-sm overflow-x-auto">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function EndpointRow({ method, path, description, quota }: {
  method: string;
  path: string;
  description: string;
  quota?: string;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    POST: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    PATCH: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    PUT: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    DELETE: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${methodColors[method] ?? "bg-muted"}`}>
        {method}
      </span>
      <div className="flex-1 min-w-0">
        <code className="text-sm font-mono break-all">{path}</code>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {quota && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{quota}</span>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <>
      <Head>
        <title>API Documentation - VidTempla</title>
        <meta name="description" content="REST API documentation for VidTempla - manage YouTube channels programmatically" />
      </Head>
      <div className="min-h-screen bg-background">
        <Navbar />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-4xl">
          <div className="mb-8">
            <Badge className="mb-4" variant="secondary">API Reference</Badge>
            <h1 className="text-4xl font-bold tracking-tight mb-4">REST API Documentation</h1>
            <p className="text-lg text-muted-foreground">
              Programmatic access to YouTube channel management. Built for AI agents and automation.
            </p>
          </div>

          {/* Quick Start */}
          <section id="quickstart" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Quick Start</h2>
            <p className="text-muted-foreground mb-4">
              Generate an API key from{" "}
              <Link href="/dashboard/settings" className="text-primary hover:underline">
                Settings
              </Link>
              , then make your first request:
            </p>
            <CodeBlock title="List your connected YouTube channels">{`curl -H "Authorization: Bearer vtk_your_key_here" \\
  https://vidtempla.com/api/v1/channels`}</CodeBlock>
          </section>

          <Separator className="my-8" />

          {/* Authentication */}
          <section id="authentication" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Authentication</h2>
            <p className="text-muted-foreground mb-4">
              All API requests require a Bearer token. API keys are prefixed with <code className="text-sm bg-muted px-1.5 py-0.5 rounded">vtk_</code> and
              can be created and revoked from the Settings page in your dashboard.
            </p>
            <CodeBlock title="Authorization header">{`Authorization: Bearer vtk_your_key_here`}</CodeBlock>
            <div className="mt-4 p-4 rounded-lg border bg-muted/30">
              <p className="text-sm">
                <strong>Security:</strong> API keys are hashed before storage. The plaintext key is shown
                only once at creation. Treat it like a password.
              </p>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Response Format */}
          <section id="response-format" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Response Format</h2>
            <p className="text-muted-foreground mb-4">
              Every response uses a consistent envelope:
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <CodeBlock title="Success">{`{
  "data": { ... },
  "error": null,
  "meta": {
    "cursor": "abc123",
    "hasMore": true,
    "total": 142
  }
}`}</CodeBlock>
              <CodeBlock title="Error">{`{
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Video not found",
    "suggestion": "Check the video ID",
    "status": 404
  }
}`}</CodeBlock>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Errors always include a <code className="bg-muted px-1 py-0.5 rounded">suggestion</code> field
              so AI agents can self-correct without human intervention.
            </p>
          </section>

          <Separator className="my-8" />

          {/* Pagination */}
          <section id="pagination" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Pagination</h2>
            <p className="text-muted-foreground mb-4">
              All list endpoints use cursor-based pagination. Pass <code className="bg-muted px-1 py-0.5 rounded">cursor</code> and
              <code className="bg-muted px-1 py-0.5 rounded"> limit</code> as query parameters.
            </p>
            <CodeBlock title="Paginated request">{`GET /api/v1/videos?limit=50&cursor=eyJpZCI6ImFiYzEyMyJ9`}</CodeBlock>
            <p className="text-sm text-muted-foreground mt-4">
              Default limit is 50, maximum is 100. The <code className="bg-muted px-1 py-0.5 rounded">cursor</code> value
              from the response <code className="bg-muted px-1 py-0.5 rounded">meta</code> should be passed as-is
              to fetch the next page. When <code className="bg-muted px-1 py-0.5 rounded">hasMore</code> is false,
              you have reached the last page.
            </p>
          </section>

          <Separator className="my-8" />

          {/* Endpoints Reference */}
          <section id="endpoints" className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Endpoints</h2>

            {/* Channels */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Channels</CardTitle>
              </CardHeader>
              <CardContent>
                <EndpointRow method="GET" path="/api/v1/channels" description="List connected YouTube channels" />
                <EndpointRow method="GET" path="/api/v1/channels/:id" description="Channel details (live from YouTube)" quota="1 unit" />
                <EndpointRow method="GET" path="/api/v1/channels/:id/overview" description="Composite: channel stats, templates, containers, video counts" quota="1 unit" />
                <EndpointRow method="POST" path="/api/v1/channels/:id/sync" description="Trigger video sync for a channel" />
                <EndpointRow method="GET" path="/api/v1/channels/:id/analytics" description="Channel analytics (views, watch time, etc.)" quota="Analytics" />
                <EndpointRow method="GET" path="/api/v1/channels/:id/search" description="Search videos within a channel" quota="100 units" />
              </CardContent>
            </Card>

            {/* Videos */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Videos</CardTitle>
              </CardHeader>
              <CardContent>
                <EndpointRow method="GET" path="/api/v1/videos" description="List videos (supports filtering by channel, container, search)" />
                <EndpointRow method="GET" path="/api/v1/videos/:id" description="Video details with live YouTube stats" quota="1 unit" />
                <EndpointRow method="GET" path="/api/v1/videos/:id/analytics" description="Per-video analytics" quota="Analytics" />
                <EndpointRow method="GET" path="/api/v1/videos/:id/retention" description="Audience retention curve (100 data points)" quota="Analytics" />
                <EndpointRow method="POST" path="/api/v1/videos/:id/assign" description="Assign video to a container" />
                <EndpointRow method="GET" path="/api/v1/videos/:id/variables" description="Get video template variables" />
                <EndpointRow method="PUT" path="/api/v1/videos/:id/variables" description="Update video template variables" />
              </CardContent>
            </Card>

            {/* Templates */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Templates</CardTitle>
              </CardHeader>
              <CardContent>
                <EndpointRow method="GET" path="/api/v1/templates" description="List templates with parsed variables" />
                <EndpointRow method="POST" path="/api/v1/templates" description="Create a template" />
                <EndpointRow method="GET" path="/api/v1/templates/:id" description="Get template details" />
                <EndpointRow method="PATCH" path="/api/v1/templates/:id" description="Update a template (triggers rebuild if content changed)" />
                <EndpointRow method="DELETE" path="/api/v1/templates/:id" description="Delete a template" />
                <EndpointRow method="GET" path="/api/v1/templates/:id/impact" description="Show affected containers and video counts" />
              </CardContent>
            </Card>

            {/* Containers */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Containers</CardTitle>
              </CardHeader>
              <CardContent>
                <EndpointRow method="GET" path="/api/v1/containers" description="List containers with video counts" />
                <EndpointRow method="POST" path="/api/v1/containers" description="Create a container" />
                <EndpointRow method="GET" path="/api/v1/containers/:id" description="Get container with template details" />
                <EndpointRow method="PATCH" path="/api/v1/containers/:id" description="Update a container (triggers rebuild)" />
                <EndpointRow method="DELETE" path="/api/v1/containers/:id" description="Delete a container" />
              </CardContent>
            </Card>

            {/* YouTube Management */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>YouTube Management</CardTitle>
              </CardHeader>
              <CardContent>
                <EndpointRow method="GET" path="/api/v1/youtube/playlists" description="List channel playlists" quota="1 unit" />
                <EndpointRow method="POST" path="/api/v1/youtube/playlists" description="Create a playlist" quota="50 units" />
                <EndpointRow method="GET" path="/api/v1/youtube/playlists/:id" description="Playlist details" quota="1 unit" />
                <EndpointRow method="PATCH" path="/api/v1/youtube/playlists/:id" description="Update a playlist" quota="50 units" />
                <EndpointRow method="DELETE" path="/api/v1/youtube/playlists/:id" description="Delete a playlist" quota="50 units" />
                <EndpointRow method="GET" path="/api/v1/youtube/playlists/:id/items" description="List playlist items" quota="1 unit" />
                <EndpointRow method="POST" path="/api/v1/youtube/playlists/:id/items" description="Add video to playlist" quota="50 units" />
                <EndpointRow method="DELETE" path="/api/v1/youtube/playlists/:id/items/:itemId" description="Remove item from playlist" quota="50 units" />
                <EndpointRow method="GET" path="/api/v1/youtube/comments/:videoId" description="List video comments" quota="1 unit" />
                <EndpointRow method="POST" path="/api/v1/youtube/comments/reply" description="Reply to a comment" quota="50 units" />
                <EndpointRow method="DELETE" path="/api/v1/youtube/comments/:commentId" description="Delete a comment" quota="50 units" />
                <EndpointRow method="PUT" path="/api/v1/youtube/thumbnails/:videoId" description="Upload custom thumbnail" quota="50 units" />
                <EndpointRow method="GET" path="/api/v1/youtube/captions/:videoId" description="List available captions" quota="50 units" />
              </CardContent>
            </Card>

            {/* Analytics */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <EndpointRow method="GET" path="/api/v1/usage" description="Your API usage stats (daily breakdown)" />
                <EndpointRow method="POST" path="/api/v1/analytics/query" description="Flexible YouTube Analytics query" quota="Analytics" />
              </CardContent>
            </Card>
          </section>

          <Separator className="my-8" />

          {/* YouTube Quota */}
          <section id="quota" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">YouTube API Quota</h2>
            <p className="text-muted-foreground mb-4">
              YouTube enforces a daily quota of 10,000 units per project. VidTempla tracks quota usage
              per API key so you can monitor consumption via the <code className="bg-muted px-1 py-0.5 rounded">/api/v1/usage</code> endpoint.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Operation Type</th>
                    <th className="text-right py-2 font-medium">Quota Units</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Data API reads (videos.list, channels.list)</td>
                    <td className="text-right py-2">1</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Search (search.list)</td>
                    <td className="text-right py-2">100</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Write operations (playlists, comments, thumbnails)</td>
                    <td className="text-right py-2">50</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">Captions</td>
                    <td className="text-right py-2">50-450</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4">VidTempla-native endpoints</td>
                    <td className="text-right py-2">0</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Analytics API</td>
                    <td className="text-right py-2">Separate pool</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Rate Limits */}
          <section id="rate-limits" className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Rate Limits</h2>
            <p className="text-muted-foreground mb-4">
              API requests are subject to the following limits:
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-2xl font-bold">1,000</p>
                  <p className="text-sm text-muted-foreground">Requests per hour per API key</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-2xl font-bold">10,000</p>
                  <p className="text-sm text-muted-foreground">YouTube quota units per day (shared across all keys)</p>
                </CardContent>
              </Card>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              When rate limited, the API returns a <code className="bg-muted px-1 py-0.5 rounded">429</code> status
              with a <code className="bg-muted px-1 py-0.5 rounded">Retry-After</code> header.
            </p>
          </section>
        </div>

        <Footer />
      </div>
    </>
  );
}
