/**
 * MCP Server Guide Page
 * How to connect AI agents to VidTempla via MCP
 */

import Head from 'next/head';
import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

const SERVER_URL = 'https://vidtempla.com/api/mcp/mcp';
const OAUTH_DISCOVERY_URL =
  'https://vidtempla.com/.well-known/oauth-authorization-server';

const toolGroups = [
  {
    name: 'Channels',
    tools: ['list_channels', 'get_channel', 'get_channel_overview'],
  },
  {
    name: 'Videos',
    tools: [
      'list_videos',
      'get_video',
      'get_video_analytics',
      'get_video_retention',
      'get_video_variables',
      'assign_video',
      'update_video_variables',
      'get_description_history',
      'revert_description',
    ],
  },
  {
    name: 'Templates',
    tools: [
      'list_templates',
      'get_template',
      'create_template',
      'update_template',
      'delete_template',
      'get_template_impact',
    ],
  },
  {
    name: 'Containers',
    tools: [
      'list_containers',
      'get_container',
      'create_container',
      'update_container',
      'delete_container',
    ],
  },
  {
    name: 'Analytics',
    tools: [
      'get_channel_analytics',
      'query_analytics',
      'search_channel_videos',
      'sync_channel',
    ],
  },
];

const quickStartConfig = JSON.stringify(
  {
    mcpServers: {
      vidtempla: {
        url: SERVER_URL,
      },
    },
  },
  null,
  2
);

export default function McpServerPage() {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <>
      <Head>
        <title>MCP Server | VidTempla</title>
      </Head>
      <DashboardLayout
        headerContent={
          <nav className="flex items-center gap-2 text-sm flex-1">
            <span className="font-medium">MCP Server</span>
          </nav>
        }
      >
        <div className="container mx-auto py-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MCP Server</h1>
            <p className="text-muted-foreground">
              Connect AI agents to VidTempla using the Model Context Protocol
            </p>
          </div>

          <div className="grid gap-6 max-w-2xl">
            {/* Server Connection */}
            <Card>
              <CardHeader>
                <CardTitle>Server Connection</CardTitle>
                <CardDescription>
                  Connection details for the VidTempla MCP server
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Server Name</span>
                  <span className="text-sm text-muted-foreground">
                    VidTempla
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Version</span>
                  <span className="text-sm text-muted-foreground">1.0.0</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Transport</span>
                  <Badge variant="secondary">Streamable HTTP</Badge>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Server URL</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md break-all">
                      {SERVER_URL}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => copyToClipboard(SERVER_URL, 'url')}
                    >
                      {copiedField === 'url' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Authentication */}
            <Card>
              <CardHeader>
                <CardTitle>Authentication</CardTitle>
                <CardDescription>
                  OAuth-based authentication via OIDC
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Auth Method</span>
                  <Badge variant="secondary">OAuth (OIDC)</Badge>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-medium">Discovery URL</span>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md break-all">
                      {OAUTH_DISCOVERY_URL}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() =>
                        copyToClipboard(OAUTH_DISCOVERY_URL, 'oauth')
                      }
                    >
                      {copiedField === 'oauth' ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  MCP clients handle OAuth automatically. When you first
                  connect, you&apos;ll be prompted to sign in and authorize
                  access.
                </p>
              </CardContent>
            </Card>

            {/* Available Tools */}
            <Card>
              <CardHeader>
                <CardTitle>Available Tools</CardTitle>
                <CardDescription>
                  {toolGroups.reduce((sum, g) => sum + g.tools.length, 0)} tools
                  across {toolGroups.length} categories
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {toolGroups.map((group) => (
                  <div key={group.name} className="space-y-1.5">
                    <span className="text-sm font-medium">{group.name}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tools.map((tool) => (
                        <code
                          key={tool}
                          className="text-xs bg-muted px-2 py-0.5 rounded"
                        >
                          {tool}
                        </code>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Quick Start */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Start</CardTitle>
                <CardDescription>
                  Add this to your MCP client configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <pre className="text-sm bg-muted px-4 py-3 rounded-md overflow-x-auto">
                    {quickStartConfig}
                  </pre>
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => copyToClipboard(quickStartConfig, 'config')}
                  >
                    {copiedField === 'config' ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
}
