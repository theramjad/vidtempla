import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import {
  FileText,
  RefreshCw,
  History,
  Layers,
  Zap,
  Youtube,
  Check,
  ArrowRight,
  Menu,
  Code,
  BarChart3,
  Bot,
  Search,
  Shield,
  MessageSquare,
} from "lucide-react";

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>VidTempla</title>
        <meta name="description" content="REST API, MCP server, and dashboard for AI agents to securely manage YouTube channels — descriptions, analytics, playlists, comments, captions, search, and more" />
      </Head>
      <div className="min-h-screen bg-background">
        <Navbar />

        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-4" variant="secondary">
              YouTube Management for AI Agents & Humans
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              The YouTube API{" "}
              <span className="text-primary">Your AI Agent Needs</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              REST API, MCP server, and dashboard to manage descriptions, analytics, playlists,
              comments, captions, search, and more. OAuth complexity handled for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/sign-in">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Learn More
                </Button>
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              No credit card required · Free plan available · Open source
            </p>
          </div>
        </section>

        <Separator className="container mx-auto" />

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              Features
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything agents need to manage YouTube
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              API-first platform with a dashboard for humans when you need it
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 - MCP Server */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>MCP Server for AI Agents</CardTitle>
                <CardDescription>
                  Connect Claude, Cursor, or any MCP-compatible AI agent directly to your YouTube channel.
                  Agents get structured tools for every operation — no prompt engineering needed.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 2 - REST API */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>REST API</CardTitle>
                <CardDescription>
                  Full REST API with Bearer token auth. Manage templates, videos, playlists, comments, captions,
                  thumbnails, and more. Every response includes error suggestions so agents can self-correct.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 3 - Full YouTube Proxy */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Youtube className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Full YouTube API Proxy</CardTitle>
                <CardDescription>
                  Search YouTube, manage playlists, read and reply to comments, handle captions, update thumbnails,
                  and query analytics — all through one API key. No YouTube OAuth headaches.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 4 - Granular Permissions */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Granular Permissions</CardTitle>
                <CardDescription>
                  Issue read-only API keys for analytics and monitoring, or read-write keys when agents need to make changes.
                  Each key is scoped so you stay in control.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 5 - Analytics */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Analytics & Search</CardTitle>
                <CardDescription>
                  Query YouTube Analytics for views, watch time, retention curves, and audience data.
                  Search across YouTube or within your own channel to find any video.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 6 - Smart Templates */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Smart Templates & Containers</CardTitle>
                <CardDescription>
                  Create reusable templates with {"`{{variables}}`"}, compose them into containers, and auto-update
                  every linked video description when a template changes.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 7 - Comments */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Comment Management</CardTitle>
                <CardDescription>
                  List, read, and reply to comments on your videos via API or MCP. Let your AI agent
                  handle community engagement while you focus on creating content.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 8 - Multi-Channel */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Layers className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Multi-Channel Support</CardTitle>
                <CardDescription>
                  Manage multiple YouTube channels with secure OAuth. Tokens encrypted at rest
                  and auto-refreshed on every API call.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 9 - Version History */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <History className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Version History & Rollback</CardTitle>
                <CardDescription>
                  Every description change is tracked. View the full history for any video and roll back
                  to any previous version with one click or one API call.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        <Separator className="container mx-auto" />

        {/* Pricing Section */}
        <section id="pricing" className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              Pricing
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that fits your needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>Perfect for trying out VidTempla</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$0</span>
                  <span className="text-muted-foreground">/forever</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Up to 5 videos</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">1 YouTube channel</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">REST API & MCP server access</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Basic template management</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Community support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/sign-in" className="w-full">
                  <Button variant="outline" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Pro Plan */}
            <Card className="border-primary shadow-lg relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
              </div>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <CardDescription>For content creators</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$20</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Unlimited videos</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">1 YouTube channel</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Advanced templates & containers</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-semibold">Automatic description updates</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Full YouTube proxy (comments, playlists, captions)</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Version history & rollback</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Priority support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/sign-in" className="w-full">
                  <Button className="w-full">
                    Get Started
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            {/* Business Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Business</CardTitle>
                <CardDescription>For agencies & businesses</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$100</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Everything in Pro</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm font-semibold">Unlimited YouTube channels</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Team collaboration</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Bulk operations</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">Dedicated support</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Link href="/sign-in" className="w-full">
                  <Button variant="outline" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        </section>

        <Separator className="container mx-auto" />

        {/* FAQ Section */}
        <section id="faq" className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center mb-16">
            <Badge className="mb-4" variant="secondary">
              FAQ
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently asked questions
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about VidTempla
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-card/50 backdrop-blur-xl border rounded-2xl shadow-lg overflow-hidden">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-left">
                  What is VidTempla?
                </AccordionTrigger>
                <AccordionContent>
                  VidTempla is an API-first platform that lets AI agents securely manage YouTube channels. It provides a REST API
                  and an MCP server that proxy the YouTube Data API and Analytics API, so your agent can do everything from
                  updating descriptions to managing playlists — without ever touching YouTube OAuth credentials directly.
                  There&apos;s also a dashboard for when humans want to do things manually.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger className="text-left">
                  What is the MCP server and how do I use it?
                </AccordionTrigger>
                <AccordionContent>
                  MCP (Model Context Protocol) lets AI agents like Claude, Cursor, and Windsurf call structured tools directly.
                  VidTempla&apos;s MCP server exposes tools for searching YouTube, managing playlists, reading comments, querying
                  analytics, updating descriptions, and more. You connect it via OAuth from your AI client — no API key management
                  needed. Your agent gets the same capabilities as the REST API but through native tool calls.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger className="text-left">
                  What YouTube operations can I perform?
                </AccordionTrigger>
                <AccordionContent>
                  Nearly everything available through the YouTube API: search across YouTube or within your channel, list and manage
                  videos, create and edit playlists, read and reply to comments, upload and manage captions, update thumbnails,
                  query analytics (views, watch time, retention curves, audience demographics), fetch transcripts, and manage
                  video descriptions with templates. All operations happen in real-time through YouTube&apos;s API — we don&apos;t
                  store your YouTube data.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger className="text-left">
                  How do API key permissions work?
                </AccordionTrigger>
                <AccordionContent>
                  Each API key has a permission level: <strong>read-only</strong> for safe operations like fetching analytics, searching
                  videos, and reading comments, or <strong>read-write</strong> for operations that modify your channel like updating
                  descriptions, managing playlists, and replying to comments. This lets you give agents only the access they need.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger className="text-left">
                  Do I need to handle YouTube OAuth myself?
                </AccordionTrigger>
                <AccordionContent>
                  No. You connect your YouTube channel once through VidTempla&apos;s dashboard. After that, the API and MCP server
                  handle all OAuth token management transparently — encryption, storage, and automatic refresh. Your agent just
                  uses a VidTempla API key and never touches YouTube credentials directly.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger className="text-left">
                  How does the template system work?
                </AccordionTrigger>
                <AccordionContent>
                  Templates use variables like {"`{{product_name}}`"} or {"`{{link}}`"} that you can customize for each video.
                  Compose multiple templates into containers with custom ordering and separators. When you update a template,
                  all linked video descriptions update automatically. This works via the dashboard, REST API, or MCP tools.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7">
                <AccordionTrigger className="text-left">
                  Is my YouTube account secure?
                </AccordionTrigger>
                <AccordionContent>
                  Yes. We use YouTube&apos;s official OAuth — we never see your password. Access tokens are encrypted at rest and
                  auto-refreshed on every API call. You can revoke access at any time through your Google account. API keys
                  are hashed and support granular permissions so agents only get the access level you choose.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8">
                <AccordionTrigger className="text-left">
                  How can I trust this application?
                </AccordionTrigger>
                <AccordionContent>
                  VidTempla is fully open source at{" "}
                  <a
                    href="https://github.com/theramjad/vidtempla"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    GitHub
                  </a>
                  . You can audit every line of code — or have an AI audit it for you. The API never stores YouTube data;
                  it proxies requests in real-time and returns results directly to your agent.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-9">
                <AccordionTrigger className="text-left">
                  Can I try it before upgrading?
                </AccordionTrigger>
                <AccordionContent>
                  Yes! The Free plan includes full API and MCP server access with up to 5 videos and 1 channel. No credit card required.
                  When you need unlimited videos, automatic description updates, or multiple channels, upgrade to Pro or Business.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-10">
                <AccordionTrigger className="text-left">
                  What happens if I make a mistake?
                </AccordionTrigger>
                <AccordionContent>
                  Every description change is versioned. You can view the full history for any video and roll back to any
                  previous version with one click in the dashboard or one API call. Description updates appear on YouTube
                  within seconds.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-primary/5 rounded-2xl p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to give your AI agent a YouTube toolkit?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect your channel, set up the MCP server or grab an API key, and let your agent manage YouTube in minutes.
            </p>
            <Link href="/sign-in">
              <Button size="lg">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    </>
  );
}
