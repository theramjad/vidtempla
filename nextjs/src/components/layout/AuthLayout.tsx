import { ReactNode } from "react";
import Link from "next/link";
import Head from "next/head";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  headTitle: string;
}

export function AuthLayout({ children, title, headTitle }: AuthLayoutProps) {
  return (
    <>
      <Head>
        <title>{headTitle}</title>
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
        .auth-page {
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

          font-family: "Source Serif 4", Georgia, serif;
          background: var(--cream);
          color: var(--text);
          line-height: 1.7;
          font-size: 18px;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .auth-page *,
        .auth-page *::before,
        .auth-page *::after {
          box-sizing: border-box;
        }
        .auth-page h1,
        .auth-page h2,
        .auth-page h3 {
          font-family: "Bricolage Grotesque", sans-serif;
          line-height: 1.2;
          color: var(--teal);
        }
        .auth-page a {
          color: var(--terracotta);
          text-decoration: none;
        }
        .auth-page a:hover {
          text-decoration: underline;
        }
      `}</style>

      <div className="auth-page">
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
          </div>
        </nav>

        {/* Content */}
        <main
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px 80px",
            position: "relative",
          }}
        >
          {/* Decorative dots */}
          <div
            style={{
              position: "absolute",
              top: 60,
              left: "10%",
              width: 120,
              height: 120,
              backgroundImage:
                "radial-gradient(var(--cream-dark) 2px, transparent 2px)",
              backgroundSize: "16px 16px",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 80,
              right: "8%",
              width: 100,
              height: 100,
              backgroundImage:
                "radial-gradient(var(--cream-dark) 2px, transparent 2px)",
              backgroundSize: "16px 16px",
              opacity: 0.6,
            }}
          />

          <div
            style={{
              width: "100%",
              maxWidth: 440,
              position: "relative",
              zIndex: 1,
            }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 16,
                border: "2px solid var(--cream-dark)",
                padding: "48px 40px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.04)",
              }}
            >
              {/* Decorative bar */}
              <div
                style={{
                  width: 48,
                  height: 6,
                  background: "var(--terracotta)",
                  borderRadius: 3,
                  marginBottom: 24,
                }}
              />
              <h1
                style={{
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  fontSize: 32,
                  fontWeight: 800,
                  color: "var(--teal)",
                  marginBottom: 8,
                }}
              >
                {title}
              </h1>
              <p
                style={{
                  fontSize: 16,
                  color: "var(--text-light)",
                  marginBottom: 32,
                }}
              >
                No password needed — we'll send you a magic link.
              </p>
              {children}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer
          style={{
            padding: "32px 0",
            borderTop: "2px dashed var(--cream-dark)",
          }}
        >
          <div
            style={{
              maxWidth: 1140,
              margin: "0 auto",
              padding: "0 24px",
              display: "flex",
              justifyContent: "center",
              gap: 28,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Privacy", href: "/legal/privacy-policy" },
              { label: "Terms", href: "/legal/terms-of-service" },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                style={{
                  fontSize: 14,
                  color: "var(--text-light)",
                  fontFamily: "'Bricolage Grotesque', sans-serif",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </>
  );
}
