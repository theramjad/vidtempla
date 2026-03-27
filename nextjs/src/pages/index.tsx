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
  History,
  Youtube,
  Check,
  ArrowRight,
  Code,
  Bot,
  Shield,
} from "lucide-react";

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>VidTempla</title>
        <meta name="description" content="Your YouTube channel, with an AI co-pilot. Connect Claude, Cursor, or any AI assistant to help with descriptions, analytics, playlists, comments, and more." />
      </Head>
      <div className="min-h-screen bg-background">
        <Navbar />

        {/* Hero Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <Badge className="mb-4" variant="secondary">
              Open source & free to start
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Your YouTube channel, with an{" "}
              <span className="text-primary">AI co-pilot</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect Claude, Cursor, or any AI as your creative assistant.
              It helps with descriptions, playlists, comments, analytics — while you stay in the driver&apos;s seat.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/sign-in">
                <Button size="lg" className="w-full sm:w-auto">
                  Start working smarter
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  See how it works
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
              What you get
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tools for you and your AI to work together
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything your AI assistant needs to help with your channel
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 - MCP Server */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Connects to your favorite AI</CardTitle>
                <CardDescription>
                  Your AI assistant hooks into VidTempla through our MCP server. No copy-pasting, no middle steps.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 2 - REST API */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Simple API access</CardTitle>
                <CardDescription>
                  Grab an API key and your AI co-pilot can start helping with your channel. Works with any tool that can make web requests.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 3 - Full YouTube */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Youtube className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Your whole channel, one connection</CardTitle>
                <CardDescription>
                  Search, playlists, comments, captions, thumbnails, analytics — your AI can assist with all of it from one place.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 4 - Permissions */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>You set the boundaries</CardTitle>
                <CardDescription>
                  Give your AI read-only access or let it make changes. You decide exactly what it&apos;s allowed to help with.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 5 - Smart Templates */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Smart descriptions</CardTitle>
                <CardDescription>
                  Create reusable templates with variables. Update one template and every video using it gets updated too.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 6 - Undo */}
            <Card>
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <History className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Undo anything</CardTitle>
                <CardDescription>
                  Every description change is saved. Made a mistake? Roll back to any previous version in one click.
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
              Pick what works for you
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Start free, upgrade when you&apos;re ready
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Free Plan */}
            <Card>
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <CardDescription>Free forever, no credit card</CardDescription>
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
                <CardDescription>Everything you need for one channel</CardDescription>
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
                <CardDescription>For agencies and multi-channel creators</CardDescription>
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
              Questions?
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              We&apos;ve got answers
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to know about VidTempla
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-card/50 backdrop-blur-xl border rounded-2xl shadow-lg overflow-hidden">
            <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-left">
                  What even is VidTempla?
                </AccordionTrigger>
                <AccordionContent>
                  It&apos;s a bridge between your AI tools (like Claude or Cursor) and your YouTube channel.
                  Instead of doing all the busywork yourself, your AI assistant helps you get it done faster through VidTempla.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger className="text-left">
                  Do I need to be a developer to use this?
                </AccordionTrigger>
                <AccordionContent>
                  Not at all! If you use an AI assistant that supports MCP (like Claude Desktop), it connects automatically.
                  No coding needed — just click connect and you&apos;re good to go.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger className="text-left">
                  Is my YouTube account safe?
                </AccordionTrigger>
                <AccordionContent>
                  Absolutely. You choose exactly what your AI assistant can help with — read-only access so it can only look,
                  or write access so it can make edits with you. Plus, every change is tracked so you can undo anything.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger className="text-left">
                  What AI tools work with VidTempla?
                </AccordionTrigger>
                <AccordionContent>
                  Anything that supports MCP — Claude Desktop, Cursor, Windsurf, and more. If your tool can make API calls,
                  it works with our REST API too. Pretty much any AI can connect.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger className="text-left">
                  What can my AI assistant help with?
                </AccordionTrigger>
                <AccordionContent>
                  Searching videos, organizing playlists, drafting comment replies, checking analytics, updating descriptions,
                  handling captions, swapping thumbnails — basically all the repetitive YouTube Studio tasks you&apos;d rather not do yourself.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-6">
                <AccordionTrigger className="text-left">
                  How do the description templates work?
                </AccordionTrigger>
                <AccordionContent>
                  You create a template once — say, your standard video description with links and social media.
                  Then every video that uses it stays in sync. Update the template, and all those descriptions update too.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-7">
                <AccordionTrigger className="text-left">
                  Can I work with multiple YouTube channels?
                </AccordionTrigger>
                <AccordionContent>
                  Yep! The free plan covers one channel. Pro gives you three, and Business is unlimited.
                  Great if you&apos;re working across channels for different brands or clients.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-8">
                <AccordionTrigger className="text-left">
                  Is VidTempla open source?
                </AccordionTrigger>
                <AccordionContent>
                  It is! The code is on{" "}
                  <a
                    href="https://github.com/theramjad/vidtempla"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    GitHub
                  </a>
                  . You can look at it, contribute, or even host it yourself if you want to. We think transparency matters.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-primary/5 rounded-2xl p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get your AI assistant set up in minutes
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Free plan, no credit card, no hassle. You and your AI, working together.
            </p>
            <Link href="/sign-in">
              <Button size="lg">
                Start working smarter
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
