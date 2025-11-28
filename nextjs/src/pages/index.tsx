import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Footer } from "@/components/layout/Footer";
import {
  FileText,
  RefreshCw,
  History,
  Layers,
  Zap,
  Youtube,
  Check,
  ArrowRight,
  Sparkles,
  Command,
  GitBranch,
  Terminal,
} from "lucide-react";

export default function LandingPage() {
  return (
    <>
      <Head>
        <title>VidTempla — YouTube Description Management</title>
        <meta name="description" content="Manage YouTube descriptions at scale with dynamic templates and variables" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Satoshi:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </Head>

      <div className="min-h-screen bg-[#0A0A0C] text-[#E8E8ED] overflow-hidden">
        {/* Ambient background effects */}
        <div className="fixed inset-0 pointer-events-none">
          {/* Gradient orbs */}
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#5E5CE6]/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] bg-[#BF5AF2]/15 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
          <div className="absolute bottom-[-10%] left-[30%] w-[700px] h-[400px] bg-[#32D74B]/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />

          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(#E8E8ED 1px, transparent 1px), linear-gradient(90deg, #E8E8ED 1px, transparent 1px)`,
              backgroundSize: '64px 64px',
            }}
          />

          {/* Noise texture overlay */}
          <div
            className="absolute inset-0 opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />
        </div>

        {/* Navigation */}
        <nav className="relative z-50 border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-12">
                <Link href="/" className="flex items-center gap-2 group">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5E5CE6] to-[#BF5AF2] flex items-center justify-center">
                    <Youtube className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-lg font-semibold tracking-tight" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                    VidTempla
                  </span>
                </Link>
                <div className="hidden md:flex items-center gap-8">
                  <Link href="#features" className="text-sm text-[#A1A1AA] hover:text-white transition-colors duration-200">
                    Features
                  </Link>
                  <Link href="#pricing" className="text-sm text-[#A1A1AA] hover:text-white transition-colors duration-200">
                    Pricing
                  </Link>
                  <Link href="#faq" className="text-sm text-[#A1A1AA] hover:text-white transition-colors duration-200">
                    FAQ
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href="/sign-in">
                  <Button
                    variant="ghost"
                    className="text-[#A1A1AA] hover:text-white hover:bg-white/[0.06] h-9 px-4 text-sm"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    Sign in
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button
                    className="h-9 px-4 text-sm bg-white text-[#0A0A0C] hover:bg-white/90 font-medium"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="relative pt-24 pb-32 md:pt-32 md:pb-40">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              {/* Eyebrow */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] mb-8 animate-fade-in"
                style={{ animationDelay: '0.1s' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#BF5AF2]" />
                <span className="text-xs text-[#A1A1AA] font-medium tracking-wide" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  DESCRIPTION MANAGEMENT REIMAGINED
                </span>
              </div>

              {/* Main headline */}
              <h1
                className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 animate-fade-in-up"
                style={{
                  fontFamily: 'Satoshi, sans-serif',
                  lineHeight: '1.05',
                  animationDelay: '0.2s'
                }}
              >
                <span className="block">YouTube descriptions,</span>
                <span className="block bg-gradient-to-r from-[#5E5CE6] via-[#BF5AF2] to-[#32D74B] bg-clip-text text-transparent">
                  beautifully managed.
                </span>
              </h1>

              {/* Subheadline */}
              <p
                className="text-lg md:text-xl text-[#A1A1AA] max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up"
                style={{
                  fontFamily: 'Satoshi, sans-serif',
                  animationDelay: '0.3s'
                }}
              >
                Update hundreds of video descriptions instantly with dynamic templates.
                Keep your content fresh, your links current, and your workflow effortless.
              </p>

              {/* CTA buttons */}
              <div
                className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up"
                style={{ animationDelay: '0.4s' }}
              >
                <Link href="/sign-in">
                  <Button
                    size="lg"
                    className="h-12 px-6 text-base bg-gradient-to-r from-[#5E5CE6] to-[#BF5AF2] hover:opacity-90 transition-opacity font-medium group"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    Start for free
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
                <Link href="#features">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-12 px-6 text-base bg-transparent border-white/[0.12] text-white hover:bg-white/[0.06] hover:border-white/[0.2] font-medium"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    <Command className="mr-2 w-4 h-4" />
                    See how it works
                  </Button>
                </Link>
              </div>

              {/* Social proof */}
              <p
                className="text-sm text-[#71717A] mt-6 animate-fade-in-up"
                style={{ animationDelay: '0.5s', fontFamily: 'Satoshi, sans-serif' }}
              >
                No credit card required · Free plan available
              </p>
            </div>

            {/* Hero visual - Terminal-style preview */}
            <div
              className="mt-20 max-w-5xl mx-auto animate-fade-in-up"
              style={{ animationDelay: '0.6s' }}
            >
              <div className="relative">
                {/* Glow effect behind the card */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#5E5CE6]/30 via-[#BF5AF2]/30 to-[#32D74B]/20 blur-3xl opacity-40" />

                {/* Main card */}
                <div className="relative rounded-2xl border border-white/[0.08] bg-[#111113]/80 backdrop-blur-xl overflow-hidden shadow-2xl">
                  {/* Window chrome */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                      <div className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
                      <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="px-4 py-1 rounded-md bg-white/[0.04] text-xs text-[#71717A]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                        vidtempla.com/dashboard
                      </div>
                    </div>
                    <div className="w-16" />
                  </div>

                  {/* Content area */}
                  <div className="p-6 md:p-8">
                    {/* Template preview */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Left: Template Editor */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-[#A1A1AA]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                          <FileText className="w-4 h-4" />
                          <span>Template</span>
                          <Badge className="ml-auto bg-[#5E5CE6]/20 text-[#5E5CE6] border-0 text-xs">Active</Badge>
                        </div>
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                          <div className="text-sm space-y-2 text-[#E8E8ED]/80">
                            <p>🎬 <span className="text-[#BF5AF2]">{"{{video_title}}"}</span></p>
                            <p className="text-[#71717A]">---</p>
                            <p>📺 Subscribe: <span className="text-[#32D74B]">{"{{channel_link}}"}</span></p>
                            <p>🔗 <span className="text-[#5E5CE6]">{"{{sponsor_message}}"}</span></p>
                            <p className="text-[#71717A]">---</p>
                            <p>Timestamps:</p>
                            <p className="text-[#A1A1AA]">{"{{timestamps}}"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Output Preview */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm text-[#A1A1AA]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                          <Youtube className="w-4 h-4 text-red-500" />
                          <span>Live Preview</span>
                          <div className="ml-auto flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-[#32D74B] animate-pulse" />
                            <span className="text-xs text-[#32D74B]">Synced</span>
                          </div>
                        </div>
                        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                          <div className="text-sm space-y-2 text-[#E8E8ED]/80">
                            <p>🎬 Building a SaaS in 7 Days</p>
                            <p className="text-[#71717A]">---</p>
                            <p>📺 Subscribe: youtube.com/@creator</p>
                            <p>🔗 Try Acme Pro free for 30 days!</p>
                            <p className="text-[#71717A]">---</p>
                            <p>Timestamps:</p>
                            <p className="text-[#A1A1AA]">0:00 Intro<br/>2:30 Setup<br/>15:00 Building</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom action bar */}
                    <div className="mt-6 pt-6 border-t border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-sm text-[#71717A]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                          <RefreshCw className="w-4 h-4" />
                          <span>247 videos synced</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#71717A]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                          <History className="w-4 h-4" />
                          <span>12 versions</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" className="h-8 text-xs text-[#A1A1AA] hover:text-white hover:bg-white/[0.06]">
                          <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                          View history
                        </Button>
                        <Button size="sm" className="h-8 text-xs bg-[#5E5CE6] hover:bg-[#5E5CE6]/90">
                          <Zap className="w-3.5 h-3.5 mr-1.5" />
                          Sync all
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative py-24 md:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            {/* Section header */}
            <div className="max-w-2xl mb-16">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] mb-6"
              >
                <Terminal className="w-3.5 h-3.5 text-[#5E5CE6]" />
                <span className="text-xs text-[#A1A1AA] font-medium tracking-wide" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  FEATURES
                </span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-bold tracking-tight mb-4"
                style={{ fontFamily: 'Satoshi, sans-serif' }}
              >
                Built for scale,{" "}
                <span className="text-[#A1A1AA]">designed for speed.</span>
              </h2>
              <p className="text-lg text-[#71717A]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                Everything you need to manage YouTube descriptions like a pro.
              </p>
            </div>

            {/* Features grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  icon: FileText,
                  title: "Smart Templates",
                  description: "Create reusable templates with {{variables}} that auto-populate with custom values for each video.",
                  gradient: "from-[#5E5CE6]",
                },
                {
                  icon: Youtube,
                  title: "Multi-Channel Support",
                  description: "Manage unlimited YouTube channels with secure OAuth authentication and automatic video syncing.",
                  gradient: "from-[#FF5F57]",
                },
                {
                  icon: RefreshCw,
                  title: "Automatic Updates",
                  description: "Change your template once and automatically update all associated video descriptions in seconds.",
                  gradient: "from-[#BF5AF2]",
                },
                {
                  icon: History,
                  title: "Version Control",
                  description: "Full change history for every video with one-click rollback to any previous version.",
                  gradient: "from-[#32D74B]",
                },
                {
                  icon: Layers,
                  title: "Container System",
                  description: "Organize multiple templates into reusable containers with customizable ordering and separators.",
                  gradient: "from-[#FEBC2E]",
                },
                {
                  icon: Zap,
                  title: "Bulk Operations",
                  description: "Update descriptions for multiple videos simultaneously with powerful bulk editing tools.",
                  gradient: "from-[#64D2FF]",
                },
              ].map((feature, index) => (
                <div
                  key={feature.title}
                  className="group relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-300"
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.gradient} to-transparent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3
                    className="text-lg font-semibold mb-2"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className="text-sm text-[#71717A] leading-relaxed"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="relative py-24 md:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            {/* Section header */}
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] mb-6"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#BF5AF2]" />
                <span className="text-xs text-[#A1A1AA] font-medium tracking-wide" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  PRICING
                </span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-bold tracking-tight mb-4"
                style={{ fontFamily: 'Satoshi, sans-serif' }}
              >
                Simple, transparent pricing.
              </h2>
              <p className="text-lg text-[#71717A]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                Start free, upgrade when you need to.
              </p>
            </div>

            {/* Pricing cards */}
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Free Plan */}
              <div className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Satoshi, sans-serif' }}>Free</h3>
                  <p className="text-sm text-[#71717A]" style={{ fontFamily: 'Satoshi, sans-serif' }}>Perfect for getting started</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ fontFamily: 'Satoshi, sans-serif' }}>$0</span>
                  <span className="text-[#71717A] ml-1">/forever</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Up to 5 videos",
                    "1 YouTube channel",
                    "Basic templates",
                    "Manual updates",
                    "Community support",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[#A1A1AA]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                      <Check className="w-4 h-4 text-[#5E5CE6]" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/sign-in" className="block">
                  <Button
                    variant="outline"
                    className="w-full h-10 bg-transparent border-white/[0.12] text-white hover:bg-white/[0.06] hover:border-white/[0.2]"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>

              {/* Pro Plan */}
              <div className="relative p-6 rounded-2xl border border-[#5E5CE6]/50 bg-gradient-to-b from-[#5E5CE6]/10 to-transparent">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-[#5E5CE6] to-[#BF5AF2] text-white border-0 text-xs px-3">
                    Most Popular
                  </Badge>
                </div>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Satoshi, sans-serif' }}>Pro</h3>
                  <p className="text-sm text-[#71717A]" style={{ fontFamily: 'Satoshi, sans-serif' }}>For content creators</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ fontFamily: 'Satoshi, sans-serif' }}>$20</span>
                  <span className="text-[#71717A] ml-1">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Unlimited videos",
                    "1 YouTube channel",
                    "Advanced templates",
                    "Automatic updates",
                    "Version history",
                    "Priority support",
                  ].map((item, i) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[#A1A1AA]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                      <Check className="w-4 h-4 text-[#5E5CE6]" />
                      <span className={i === 3 ? "font-medium text-white" : ""}>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-in" className="block">
                  <Button
                    className="w-full h-10 bg-gradient-to-r from-[#5E5CE6] to-[#BF5AF2] hover:opacity-90 transition-opacity"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>

              {/* Business Plan */}
              <div className="relative p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'Satoshi, sans-serif' }}>Business</h3>
                  <p className="text-sm text-[#71717A]" style={{ fontFamily: 'Satoshi, sans-serif' }}>For agencies & teams</p>
                </div>
                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ fontFamily: 'Satoshi, sans-serif' }}>$100</span>
                  <span className="text-[#71717A] ml-1">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Everything in Pro",
                    "Unlimited channels",
                    "Team collaboration",
                    "Bulk operations",
                    "API access",
                    "Dedicated support",
                  ].map((item, i) => (
                    <li key={item} className="flex items-center gap-3 text-sm text-[#A1A1AA]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                      <Check className="w-4 h-4 text-[#5E5CE6]" />
                      <span className={i === 1 ? "font-medium text-white" : ""}>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/sign-in" className="block">
                  <Button
                    variant="outline"
                    className="w-full h-10 bg-transparent border-white/[0.12] text-white hover:bg-white/[0.06] hover:border-white/[0.2]"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="relative py-24 md:py-32">
          <div className="max-w-3xl mx-auto px-6 lg:px-8">
            {/* Section header */}
            <div className="text-center mb-16">
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/[0.08] mb-6"
              >
                <Command className="w-3.5 h-3.5 text-[#32D74B]" />
                <span className="text-xs text-[#A1A1AA] font-medium tracking-wide" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  FAQ
                </span>
              </div>
              <h2
                className="text-3xl md:text-5xl font-bold tracking-tight mb-4"
                style={{ fontFamily: 'Satoshi, sans-serif' }}
              >
                Questions? Answers.
              </h2>
            </div>

            {/* FAQ accordion */}
            <Accordion type="single" collapsible className="space-y-3">
              {[
                {
                  question: "How does the template system work?",
                  answer: "Templates use variables like {{product_name}} or {{link}} that you can customize for each video. When you update a template, all videos using that template can be automatically updated with the new content while keeping their unique variable values."
                },
                {
                  question: "Can I try it before upgrading?",
                  answer: "Yes! Start with our Free plan to test VidTempla with up to 5 videos. No credit card required. When you're ready to scale, upgrade to Pro or Business to unlock unlimited videos and automatic updates."
                },
                {
                  question: "How many videos can I manage?",
                  answer: "The Free plan supports up to 5 videos, perfect for testing. Pro and Business plans offer unlimited videos, allowing you to manage your entire YouTube catalog."
                },
                {
                  question: "Can I use this with multiple YouTube channels?",
                  answer: "Yes! The Free and Pro plans include 1 YouTube channel. The Business plan supports unlimited channels, making it ideal for agencies managing multiple clients."
                },
                {
                  question: "Is my YouTube account secure?",
                  answer: "Absolutely. We use YouTube's official OAuth authentication, which means we never see your password. Your access tokens are encrypted and stored securely. You can revoke access at any time."
                },
                {
                  question: "How can I trust this application?",
                  answer: "This application is open source and available on GitHub. You can review the code yourself to ensure it's only doing what it claims—updating YouTube descriptions."
                },
                {
                  question: "What are containers and how do they work?",
                  answer: "Containers let you combine multiple templates into a single description. Group your intro, product details, and social links together with customizable ordering and separators."
                },
                {
                  question: "Can I update descriptions automatically?",
                  answer: "Yes! With Pro and Business plans, you can enable automatic updates. When you modify a template, VidTempla will automatically push the updated descriptions to all associated videos."
                },
                {
                  question: "What happens if I make a mistake?",
                  answer: "Every description change is versioned and tracked. You can view the complete history of changes and rollback to any previous version with a single click."
                },
              ].map((item, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border border-white/[0.06] rounded-xl bg-white/[0.02] px-6 data-[state=open]:bg-white/[0.04]"
                >
                  <AccordionTrigger
                    className="text-left py-4 hover:no-underline text-[#E8E8ED] [&[data-state=open]]:text-white"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent
                    className="text-[#71717A] pb-4 leading-relaxed"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 md:py-32">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden">
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#5E5CE6]/20 via-[#BF5AF2]/10 to-[#32D74B]/10" />
              <div className="absolute inset-0 bg-[#111113]/50 backdrop-blur-xl" />

              {/* Border glow */}
              <div className="absolute inset-0 rounded-3xl border border-white/[0.1]" />

              <div className="relative px-8 py-16 md:px-16 md:py-24 text-center">
                <h2
                  className="text-3xl md:text-5xl font-bold tracking-tight mb-4"
                  style={{ fontFamily: 'Satoshi, sans-serif' }}
                >
                  Ready to streamline your workflow?
                </h2>
                <p
                  className="text-lg text-[#A1A1AA] max-w-xl mx-auto mb-8"
                  style={{ fontFamily: 'Satoshi, sans-serif' }}
                >
                  Join creators who save hours every week managing their video descriptions.
                </p>
                <Link href="/sign-in">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base bg-white text-[#0A0A0C] hover:bg-white/90 font-medium group"
                    style={{ fontFamily: 'Satoshi, sans-serif' }}
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative border-t border-white/[0.06] py-12">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#5E5CE6] to-[#BF5AF2] flex items-center justify-center">
                  <Youtube className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm text-[#71717A]" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                  © 2024 VidTempla
                </span>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="text-sm text-[#71717A] hover:text-white transition-colors" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                  Privacy
                </Link>
                <Link href="/terms" className="text-sm text-[#71717A] hover:text-white transition-colors" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                  Terms
                </Link>
                <Link href="/refund" className="text-sm text-[#71717A] hover:text-white transition-colors" style={{ fontFamily: 'Satoshi, sans-serif' }}>
                  Refund Policy
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Custom styles */}
      <style jsx global>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
          opacity: 0;
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </>
  );
}
