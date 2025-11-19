import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  RefreshCw,
  History,
  Layers,
  Zap,
  Youtube,
  Check,
  ArrowRight,
  Menu
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="text-2xl font-bold text-primary">
                VidTempla
              </Link>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </a>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button size="sm">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <Badge className="mb-4" variant="secondary">
            YouTube Description Manager
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Manage YouTube Descriptions{" "}
            <span className="text-primary">at Scale</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Update hundreds of video descriptions instantly with dynamic templates and variables.
            Keep your content fresh without the manual work.
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
            No credit card required · Free plan available
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
            Everything you need to manage descriptions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful tools to streamline your YouTube workflow
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Smart Templates</CardTitle>
              <CardDescription>
                Create reusable templates with {"`{{variables}}`"} that auto-populate with custom values for each video.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 2 */}
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Youtube className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Multi-Channel Support</CardTitle>
              <CardDescription>
                Manage unlimited YouTube channels with secure OAuth authentication and automatic video syncing.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 3 */}
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <RefreshCw className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Automatic Updates</CardTitle>
              <CardDescription>
                Change your template once and automatically update all associated video descriptions in seconds.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 4 */}
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <History className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Version Control</CardTitle>
              <CardDescription>
                Full change history for every video with one-click rollback to any previous version.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 5 */}
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Container System</CardTitle>
              <CardDescription>
                Organize multiple templates into reusable containers with customizable ordering and separators.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Feature 6 */}
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Bulk Operations</CardTitle>
              <CardDescription>
                Update descriptions for multiple videos simultaneously with powerful bulk editing tools.
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
                  <span className="text-sm">Basic template management</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm">Manual description updates</span>
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
                  <span className="text-sm">Advanced template system</span>
                </li>
                <li className="flex items-start">
                  <Check className="h-5 w-5 text-primary mr-2 mt-0.5 flex-shrink-0" />
                  <span className="text-sm font-semibold">Automatic description updates</span>
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
                  <span className="text-sm">API access</span>
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

        <Accordion type="single" collapsible className="max-w-3xl mx-auto">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-left">
              How does the template system work?
            </AccordionTrigger>
            <AccordionContent>
              Templates use variables like {"`{{product_name}}`"} or {"`{{link}}`"} that you can customize for each video.
              When you update a template, all videos using that template can be automatically updated with the new content
              while keeping their unique variable values.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger className="text-left">
              Can I update descriptions automatically?
            </AccordionTrigger>
            <AccordionContent>
              Yes! With Pro and Business plans, you can enable automatic updates. When you modify a template or container,
              VidTempla will automatically push the updated descriptions to all associated videos on YouTube. This happens in
              the background via our job processing system.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger className="text-left">
              How many videos can I manage?
            </AccordionTrigger>
            <AccordionContent>
              The Free plan supports up to 5 videos, perfect for testing. Pro and Business plans offer unlimited videos,
              allowing you to manage your entire YouTube catalog. The Business plan also supports unlimited channels.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4">
            <AccordionTrigger className="text-left">
              Is my YouTube account secure?
            </AccordionTrigger>
            <AccordionContent>
              Absolutely. We use YouTube&apos;s official OAuth authentication, which means we never see your password.
              Your access tokens are encrypted and stored securely. You can revoke VidTempla&apos;s access at any time through
              your Google account settings.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-5">
            <AccordionTrigger className="text-left">
              What happens if I make a mistake?
            </AccordionTrigger>
            <AccordionContent>
              Every description change is versioned and tracked. You can view the complete history of changes for any video
              and rollback to any previous version with a single click. This gives you confidence to experiment without
              fear of losing your content.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-6">
            <AccordionTrigger className="text-left">
              Can I try it before upgrading?
            </AccordionTrigger>
            <AccordionContent>
              Yes! Start with our Free plan to test VidTempla with up to 5 videos. No credit card required. When you&apos;re ready
              to scale, upgrade to Pro or Business to unlock unlimited videos and automatic updates.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-primary/5 rounded-2xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to streamline your YouTube workflow?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join content creators who save hours every week managing their video descriptions.
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
      <footer className="border-t">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-muted-foreground">
              © 2025 VidTempla. All rights reserved.
            </div>
            <div className="flex items-center space-x-6">
              <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign In
              </Link>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
