import { ReactNode } from "react";
import Link from "next/link";
import Head from "next/head";

interface LegalLayoutProps {
  children: ReactNode;
  title: string;
  lastUpdated: string;
}

export function LegalLayout({ children, title, lastUpdated }: LegalLayoutProps) {
  return (
    <>
      <Head>
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
        .legal-page {
          --cream: #faf8f5;
          --cream-dark: #f0ece5;
          --terracotta: #c75c2e;
          --teal: #1a535c;
          --teal-light: #2a7a87;
          --yellow: #f4b942;
          --yellow-light: #f9d47e;
          --text: #2d2a26;
          --text-light: #6b6560;

          font-family: "Source Serif 4", Georgia, serif;
          background: var(--cream);
          color: var(--text);
          line-height: 1.7;
          font-size: 18px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .legal-page *,
        .legal-page *::before,
        .legal-page *::after {
          box-sizing: border-box;
        }
        .legal-page h1,
        .legal-page h2,
        .legal-page h3,
        .legal-page h4 {
          font-family: "Bricolage Grotesque", sans-serif;
          line-height: 1.2;
          color: var(--teal);
        }
        .legal-page a {
          color: var(--terracotta);
          text-decoration: underline;
        }
        .legal-page a:hover {
          text-decoration: none;
        }

        .legal-content h2 {
          font-size: 28px;
          font-weight: 700;
          margin-top: 40px;
          margin-bottom: 16px;
        }
        .legal-content h3 {
          font-size: 22px;
          font-weight: 700;
          margin-top: 28px;
          margin-bottom: 12px;
        }
        .legal-content p {
          font-size: 17px;
          line-height: 1.8;
          margin-bottom: 16px;
          color: var(--text);
        }
        .legal-content ul,
        .legal-content ol {
          padding-left: 24px;
          margin-bottom: 16px;
        }
        .legal-content li {
          margin-bottom: 8px;
          font-size: 17px;
          line-height: 1.7;
        }
        .legal-content strong {
          color: var(--teal);
        }
      `}</style>

      <div className="legal-page">
        {/* Nav */}
        <nav style={{ padding: "20px 0", position: "relative", zIndex: 10 }}>
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
            <Link
              href="/"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                color: "var(--text-light)",
                fontWeight: 500,
                fontSize: 16,
                textDecoration: "none",
              }}
            >
              &larr; Back to home
            </Link>
          </div>
        </nav>

        {/* Content */}
        <main style={{ flex: 1, padding: "40px 0 80px" }}>
          <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
            <div
              style={{
                background: "white",
                borderRadius: 16,
                border: "2px solid var(--cream-dark)",
                padding: "48px 56px",
              }}
            >
              <h1
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: "clamp(32px, 5vw, 44px)",
                  fontWeight: 800,
                  color: "var(--teal)",
                  marginBottom: 8,
                }}
              >
                {title}
              </h1>
              <p
                style={{
                  fontSize: 15,
                  color: "var(--text-light)",
                  marginBottom: 40,
                  paddingBottom: 28,
                  borderBottom: "2px dashed var(--cream-dark)",
                }}
              >
                Last updated: {lastUpdated}
              </p>
              <div className="legal-content">{children}</div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer
          style={{
            padding: "48px 0",
            borderTop: "2px dashed var(--cream-dark)",
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
                { label: "Privacy", href: "/legal/privacy-policy" },
                { label: "Terms", href: "/legal/terms-of-service" },
                { label: "Refund Policy", href: "/legal/refund-policy" },
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
