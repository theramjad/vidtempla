import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (i: number) => setOpenFaq(openFaq === i ? null : i);

  return (
    <>
      <Head>
        <title>VidTempla</title>
        <meta
          name="description"
          content="Your YouTube channel, with an AI co-pilot. Connect Claude, Cursor, or any AI assistant to help with descriptions, analytics, playlists, comments, and more."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,500;0,8..60,600;1,8..60,400&display=swap"
          rel="stylesheet"
        />
      </Head>

      <style jsx global>{`
        .landing-page {
          --cream: #faf8f5;
          --cream-dark: #f0ece5;
          --terracotta: #c75c2e;
          --terracotta-light: #e8845a;
          --teal: #1a535c;
          --teal-light: #2a7a87;
          --yellow: #f4b942;
          --yellow-light: #f9d47e;
          --text: #2d2a26;
          --text-light: #6b6560;
          --radius: 16px;

          font-family: "Source Serif 4", Georgia, serif;
          background: var(--cream);
          color: var(--text);
          line-height: 1.7;
          font-size: 18px;
          overflow-x: hidden;
          min-height: 100vh;
        }
        .landing-page *,
        .landing-page *::before,
        .landing-page *::after {
          box-sizing: border-box;
        }
        .landing-page h1,
        .landing-page h2,
        .landing-page h3,
        .landing-page h4,
        .landing-page h5,
        .landing-page h6 {
          font-family: "Bricolage Grotesque", sans-serif;
          line-height: 1.2;
        }
        .landing-page a {
          color: var(--terracotta);
          text-decoration: none;
        }
        .landing-page a:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="landing-page">
        {/* ─── NAV ─── */}
        <nav
          style={{
            padding: "20px 0",
            position: "relative",
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: 1140,
              margin: "0 auto",
              padding: "0 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Link
              href="/"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 800,
                fontSize: 26,
                color: "var(--teal)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 32,
                  height: 32,
                  background: "var(--terracotta)",
                  borderRadius: 8,
                  transform: "rotate(3deg)",
                }}
              />
              VidTempla
            </Link>
            <div
              style={{
                display: "flex",
                gap: 32,
                alignItems: "center",
                listStyle: "none",
              }}
            >
              <a
                href="#features"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: "var(--text)",
                  fontWeight: 500,
                  fontSize: 16,
                }}
              >
                Features
              </a>
              <a
                href="#pricing"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: "var(--text)",
                  fontWeight: 500,
                  fontSize: 16,
                }}
              >
                Pricing
              </a>
              <a
                href="#faq"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: "var(--text)",
                  fontWeight: 500,
                  fontSize: 16,
                }}
              >
                FAQ
              </a>
              <Link
                href="/reference"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  color: "var(--text)",
                  fontWeight: 500,
                  fontSize: 16,
                }}
              >
                API Reference
              </Link>
              <Link
                href="/sign-in"
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  background: "var(--terracotta)",
                  color: "white",
                  padding: "10px 24px",
                  borderRadius: 50,
                  fontWeight: 600,
                  fontSize: 16,
                  lineHeight: 1,
                  textDecoration: "none",
                }}
              >
                Get started free
              </Link>
            </div>
          </div>
        </nav>

        {/* ─── HERO ─── */}
        <section
          style={{
            padding: "80px 0 100px",
            textAlign: "center",
            position: "relative",
          }}
        >
          {/* Decorative dots */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 120,
              height: 120,
              backgroundImage:
                "radial-gradient(var(--yellow-light) 2px, transparent 2px)",
              backgroundSize: "16px 16px",
              opacity: 0.5,
              top: 20,
              right: "5%",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 120,
              height: 120,
              backgroundImage:
                "radial-gradient(var(--yellow-light) 2px, transparent 2px)",
              backgroundSize: "16px 16px",
              opacity: 0.5,
              bottom: 40,
              left: "3%",
              pointerEvents: "none",
            }}
          />
          <div
            style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}
          >
            <span
              style={{
                display: "inline-block",
                background: "var(--yellow-light)",
                color: "var(--text)",
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                padding: "6px 18px",
                borderRadius: 50,
                marginBottom: 28,
                border: "2px dashed var(--yellow)",
              }}
            >
              Open source & free to start
            </span>
            <h1
              style={{
                fontSize: "clamp(40px, 6vw, 72px)",
                fontWeight: 800,
                color: "var(--teal)",
                maxWidth: 800,
                margin: "0 auto 24px",
              }}
            >
              Your YouTube channel, with an{" "}
              <span
                style={{
                  color: "var(--terracotta)",
                  position: "relative",
                  fontStyle: "normal",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    bottom: 2,
                    left: -4,
                    right: -4,
                    height: 12,
                    background: "var(--yellow-light)",
                    zIndex: 0,
                    borderRadius: 4,
                    transform: "rotate(-1deg)",
                  }}
                />
                <span style={{ position: "relative", zIndex: 1 }}>
                  AI co-pilot
                </span>
              </span>
            </h1>
            <p
              style={{
                fontSize: 20,
                color: "var(--text-light)",
                maxWidth: 560,
                margin: "0 auto 40px",
              }}
            >
              Connect Claude, Cursor, or any AI as your creative assistant. It
              helps with descriptions, playlists, comments, analytics — while
              you stay in the driver&apos;s seat.
            </p>
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="/sign-in"
                style={{
                  display: "inline-block",
                  background: "var(--terracotta)",
                  color: "white",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "16px 36px",
                  borderRadius: 50,
                  boxShadow: "0 4px 0 #a04a22",
                  textDecoration: "none",
                }}
              >
                Start working smarter
              </Link>
              <a
                href="#features"
                style={{
                  display: "inline-block",
                  background: "transparent",
                  color: "var(--teal)",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "16px 36px",
                  borderRadius: 50,
                  border: "3px solid var(--teal)",
                  textDecoration: "none",
                }}
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        {/* ─── FEATURES ─── */}
        <section
          id="features"
          style={{ padding: "80px 0 100px", position: "relative" }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 120,
              height: 120,
              backgroundImage:
                "radial-gradient(var(--yellow-light) 2px, transparent 2px)",
              backgroundSize: "16px 16px",
              opacity: 0.5,
              top: -40,
              left: "2%",
              pointerEvents: "none",
            }}
          />
          <div
            style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}
          >
            <p
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 2,
                color: "var(--terracotta)",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              What you get
            </p>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 800,
                color: "var(--teal)",
                textAlign: "center",
                marginBottom: 60,
              }}
            >
              Tools for you and your AI to work together
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 28,
              }}
            >
              {[
                {
                  icon: "🔌",
                  bg: "#e0f0f2",
                  title: "Connects to your favorite AI",
                  desc: "Your AI assistant hooks into VidTempla through our MCP server. No copy-pasting, no middle steps.",
                  rotate: -0.8,
                },
                {
                  icon: "🔑",
                  bg: "#fce8de",
                  title: "Simple API access",
                  desc: "Grab an API key and your AI co-pilot can start helping with your channel. Works with any tool that can make web requests.",
                  rotate: 0.5,
                },
                {
                  icon: "📺",
                  bg: "#fef3d9",
                  title: "Your whole channel, one connection",
                  desc: "Search, playlists, comments, captions, thumbnails, analytics — your AI can assist with all of it from one place.",
                  rotate: -0.4,
                },
                {
                  icon: "🛡️",
                  bg: "#e0f0f2",
                  title: "You set the boundaries",
                  desc: "Give your AI read-only access or let it make changes. You decide exactly what it's allowed to help with.",
                  rotate: 0.7,
                },
                {
                  icon: "📝",
                  bg: "#fce8de",
                  title: "Smart descriptions",
                  desc: "Create reusable templates with variables. Update one template and every video using it gets updated too.",
                  rotate: -0.6,
                },
                {
                  icon: "⏪",
                  bg: "#fef3d9",
                  title: "Undo anything",
                  desc: "Every description change is saved. Made a mistake? Roll back to any previous version in one click.",
                  rotate: 0.3,
                },
              ].map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: "white",
                    padding: "36px 32px",
                    borderRadius: "var(--radius)",
                    border: "2px solid var(--cream-dark)",
                    transform: `rotate(${f.rotate}deg)`,
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      "rotate(0deg) translateY(-4px)";
                    e.currentTarget.style.boxShadow =
                      "0 12px 32px rgba(0,0,0,0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = `rotate(${f.rotate}deg)`;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      marginBottom: 20,
                      background: f.bg,
                    }}
                  >
                    {f.icon}
                  </div>
                  <h3
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: "var(--teal)",
                      marginBottom: 10,
                    }}
                  >
                    {f.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 16,
                      color: "var(--text-light)",
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section
          id="pricing"
          style={{
            padding: "80px 0 100px",
            background: "linear-gradient(180deg, var(--cream) 0%, #f3efe8 100%)",
          }}
        >
          <div
            style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}
          >
            <p
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 2,
                color: "var(--terracotta)",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              Pricing
            </p>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 800,
                color: "var(--teal)",
                textAlign: "center",
                marginBottom: 60,
              }}
            >
              Pick what works for you
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 28,
                alignItems: "start",
              }}
            >
              {/* Free */}
              <div
                style={{
                  background: "white",
                  borderRadius: "var(--radius)",
                  padding: "40px 32px",
                  border: "2px solid var(--cream-dark)",
                  transition: "transform 0.2s",
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--teal)",
                    marginBottom: 6,
                  }}
                >
                  Free
                </h3>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 48,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  $0
                </div>
                <p
                  style={{
                    fontSize: 15,
                    color: "var(--text-light)",
                    marginBottom: 28,
                  }}
                >
                  Free forever, no credit card
                </p>
                <ul style={{ listStyle: "none", marginBottom: 32, padding: 0 }}>
                  {[
                    "1 YouTube channel",
                    "Up to 5 videos",
                    "MCP server access",
                    "REST API access",
                    "Basic templates",
                  ].map((item) => (
                    <li
                      key={item}
                      style={{
                        padding: "8px 0",
                        fontSize: 16,
                        color: "var(--text)",
                        borderBottom: "1px dashed var(--cream-dark)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          color: "var(--terracotta)",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: 14,
                    borderRadius: 50,
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    lineHeight: 1,
                    border: "3px solid var(--teal)",
                    color: "var(--teal)",
                    textDecoration: "none",
                  }}
                >
                  Get started
                </Link>
              </div>

              {/* Pro */}
              <div
                style={{
                  background: "white",
                  borderRadius: "var(--radius)",
                  padding: "40px 32px",
                  border: "2px solid var(--terracotta)",
                  boxShadow: "0 8px 32px rgba(199, 92, 46, 0.15)",
                  position: "relative",
                  transition: "transform 0.2s",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: -14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--terracotta)",
                    color: "white",
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "4px 20px",
                    borderRadius: 50,
                  }}
                >
                  Most popular
                </span>
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--teal)",
                    marginBottom: 6,
                  }}
                >
                  Pro
                </h3>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 48,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  $20
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      color: "var(--text-light)",
                    }}
                  >
                    /mo
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 15,
                    color: "var(--text-light)",
                    marginBottom: 28,
                  }}
                >
                  Everything you need for one channel
                </p>
                <ul style={{ listStyle: "none", marginBottom: 32, padding: 0 }}>
                  {[
                    "Unlimited videos",
                    "1 YouTube channel",
                    "Read & write API keys",
                    "Advanced templates & containers",
                    "Automatic description updates",
                    "Version history & rollback",
                    "Priority support",
                  ].map((item) => (
                    <li
                      key={item}
                      style={{
                        padding: "8px 0",
                        fontSize: 16,
                        color: "var(--text)",
                        borderBottom: "1px dashed var(--cream-dark)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          color: "var(--terracotta)",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: 14,
                    borderRadius: 50,
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    lineHeight: 1,
                    background: "var(--terracotta)",
                    color: "white",
                    boxShadow: "0 4px 0 #a04a22",
                    textDecoration: "none",
                  }}
                >
                  Get started
                </Link>
              </div>

              {/* Business */}
              <div
                style={{
                  background: "white",
                  borderRadius: "var(--radius)",
                  padding: "40px 32px",
                  border: "2px solid var(--cream-dark)",
                  transition: "transform 0.2s",
                }}
              >
                <h3
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--teal)",
                    marginBottom: 6,
                  }}
                >
                  Business
                </h3>
                <div
                  style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 48,
                    fontWeight: 800,
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  $100
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      color: "var(--text-light)",
                    }}
                  >
                    /mo
                  </span>
                </div>
                <p
                  style={{
                    fontSize: 15,
                    color: "var(--text-light)",
                    marginBottom: 28,
                  }}
                >
                  For agencies and multi-channel creators
                </p>
                <ul style={{ listStyle: "none", marginBottom: 32, padding: 0 }}>
                  {[
                    "Everything in Pro",
                    "Unlimited channels",
                    "Team members",
                    "Multiple API keys",
                    "Dedicated support",
                  ].map((item) => (
                    <li
                      key={item}
                      style={{
                        padding: "8px 0",
                        fontSize: 16,
                        color: "var(--text)",
                        borderBottom: "1px dashed var(--cream-dark)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          color: "var(--terracotta)",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-in"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: 14,
                    borderRadius: 50,
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontWeight: 700,
                    fontSize: 16,
                    lineHeight: 1,
                    border: "3px solid var(--teal)",
                    color: "var(--teal)",
                    textDecoration: "none",
                  }}
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FAQ ─── */}
        <section
          id="faq"
          style={{ padding: "80px 0 100px", position: "relative" }}
        >
          <div
            style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}
          >
            <p
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 2,
                color: "var(--terracotta)",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              Questions?
            </p>
            <h2
              style={{
                fontSize: "clamp(28px, 4vw, 44px)",
                fontWeight: 800,
                color: "var(--teal)",
                textAlign: "center",
                marginBottom: 60,
              }}
            >
              We&apos;ve got answers
            </h2>
            <div style={{ maxWidth: 780, margin: "0 auto" }}>
              {[
                {
                  q: "What even is VidTempla?",
                  a: "It's a bridge between your AI tools (like Claude or Cursor) and your YouTube channel. Instead of doing all the busywork yourself, your AI assistant helps you get it done faster through VidTempla.",
                },
                {
                  q: "Do I need to be a developer to use this?",
                  a: "Not at all! If you use an AI assistant that supports MCP (like Claude Desktop), it connects automatically. No coding needed — just click connect and you're good to go.",
                },
                {
                  q: "Is my YouTube account safe?",
                  a: "Absolutely. You choose exactly what your AI assistant can help with — read-only access so it can only look, or write access so it can make edits with you. Plus, every change is tracked so you can undo anything.",
                },
                {
                  q: "What AI tools work with VidTempla?",
                  a: "Anything that supports MCP — Claude Desktop, Cursor, Windsurf, and more. If your tool can make API calls, it works with our REST API too. Pretty much any AI can connect.",
                },
                {
                  q: "What can my AI assistant help with?",
                  a: "Searching videos, organizing playlists, drafting comment replies, checking analytics, updating descriptions, handling captions, swapping thumbnails — basically all the repetitive YouTube Studio tasks you'd rather not do yourself.",
                },
                {
                  q: "How do the description templates work?",
                  a: "You create a template once — say, your standard video description with links and social media. Then every video that uses it stays in sync. Update the template, and all those descriptions update too.",
                },
                {
                  q: "Can I work with multiple YouTube channels?",
                  a: "Yep! The free plan covers one channel. Pro gives you three, and Business is unlimited. Great if you're working across channels for different brands or clients.",
                },
                {
                  q: "Is VidTempla open source?",
                  a: 'It is! The code is on <a href="https://github.com/theramjad/vidtempla" target="_blank" rel="noopener noreferrer" style="color: var(--terracotta);">GitHub</a>. You can look at it, contribute, or even host it yourself if you want to. We think transparency matters.',
                },
              ].map((faq, i) => (
                <div
                  key={i}
                  style={{
                    borderBottom: "2px dashed var(--cream-dark)",
                    padding: "28px 0",
                    ...(i === 0
                      ? { borderTop: "2px dashed var(--cream-dark)" }
                      : {}),
                  }}
                >
                  <div
                    onClick={() => toggleFaq(i)}
                    style={{
                      fontFamily: "'Bricolage Grotesque', sans-serif",
                      fontSize: 19,
                      fontWeight: 700,
                      color: "var(--teal)",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                    }}
                  >
                    {faq.q}
                    <span
                      style={{
                        fontSize: 28,
                        fontWeight: 400,
                        color: "var(--terracotta)",
                        flexShrink: 0,
                        transition: "transform 0.2s",
                        transform:
                          openFaq === i ? "rotate(45deg)" : "rotate(0deg)",
                      }}
                    >
                      +
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 17,
                      color: "var(--text-light)",
                      marginTop: openFaq === i ? 14 : 0,
                      maxHeight: openFaq === i ? 200 : 0,
                      overflow: "hidden",
                      transition: "max-height 0.3s ease, margin-top 0.3s ease",
                    }}
                    dangerouslySetInnerHTML={{ __html: faq.a }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA ─── */}
        <section style={{ padding: "80px 0 100px", textAlign: "center" }}>
          <div
            style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px" }}
          >
            <div
              style={{
                background: "var(--teal)",
                borderRadius: 24,
                padding: "64px 48px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Decorative circles */}
              <div
                style={{
                  position: "absolute",
                  top: -60,
                  right: -60,
                  width: 200,
                  height: 200,
                  background: "var(--teal-light)",
                  borderRadius: "50%",
                  opacity: 0.3,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: -40,
                  left: -40,
                  width: 140,
                  height: 140,
                  background: "var(--yellow)",
                  borderRadius: "50%",
                  opacity: 0.15,
                }}
              />
              <h2
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: "clamp(28px, 4vw, 42px)",
                  fontWeight: 800,
                  color: "white",
                  marginBottom: 16,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Get your AI assistant set up in minutes
              </h2>
              <p
                style={{
                  fontSize: 19,
                  color: "rgba(255,255,255,0.8)",
                  maxWidth: 500,
                  margin: "0 auto 36px",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Free plan, no credit card, no hassle. You and your AI, working
                together.
              </p>
              <Link
                href="/sign-in"
                style={{
                  display: "inline-block",
                  background: "var(--yellow)",
                  color: "var(--text)",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                  padding: "16px 36px",
                  borderRadius: 50,
                  lineHeight: 1,
                  boxShadow: "0 4px 0 #c99520",
                  textDecoration: "none",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                Start working smarter
              </Link>
            </div>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer
          style={{ padding: "48px 0", borderTop: "2px dashed var(--cream-dark)" }}
        >
          <div
            style={{
              maxWidth: 1140,
              margin: "0 auto",
              padding: "0 24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 20,
            }}
          >
            <Link
              href="/"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 800,
                fontSize: 20,
                color: "var(--teal)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                textDecoration: "none",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 24,
                  height: 24,
                  background: "var(--terracotta)",
                  borderRadius: 6,
                  transform: "rotate(3deg)",
                }}
              />
              VidTempla
            </Link>
            <div style={{ display: "flex", gap: 28 }}>
              {[
                { label: "API Docs", href: "/reference" },
                {
                  label: "GitHub",
                  href: "https://github.com/theramjad/vidtempla",
                },
                { label: "Privacy", href: "/legal/privacy-policy" },
                { label: "Terms", href: "/legal/terms-of-service" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  style={{
                    fontSize: 15,
                    color: "var(--text-light)",
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    textDecoration: "none",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <p
              style={{
                fontSize: 14,
                color: "var(--text-light)",
                width: "100%",
                textAlign: "center",
                marginTop: 12,
              }}
            >
              &copy; 2026 VidTempla. Made with care for creators and their AI
              co-pilots.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
