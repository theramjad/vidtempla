// @ts-check
/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation.
 * This is especially useful for Docker builds.
 */
!process.env.SKIP_ENV_VALIDATION && (await import("./src/env/server.mjs"));
import createMDX from "@next/mdx";

/** @type {import("next").NextConfig} */
const config = {
  reactStrictMode: true,
  serverExternalPackages: ["postgres"],
  images: {
    remotePatterns: [
      /* YouTube thumbnails */
      {
        hostname: "yt3.ggpht.com",
      },
      {
        hostname: "i.ytimg.com",
      },
      /* Prod */
      {
        hostname: "placehold.jp",
      },
      {
        hostname: "assets-prod.tensorai.app",
      },
      {
        hostname: "assets-prod-cdn.tensorai.app",
      },
      {
        hostname: "assets-dev.tensorai.app",
      },
      {
        hostname: "assets-dev-cdn.tensorai.app",
      },
      /* Dev */
      {
        protocol: "http",
        hostname: "10.221.182.22",
        port: "54321",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
      },
    ],
  },
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"], // Enable MDX pages
  async headers() {
    return [
      {
        source: "/privacy",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' app.termly.io vercel.live",
              "frame-src 'self' app.termly.io",
              "connect-src 'self' app.termly.io",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/terms",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' app.termly.io vercel.live",
              "frame-src 'self' app.termly.io",
              "connect-src 'self' app.termly.io",
              "img-src 'self' data: https:",
              "style-src 'self' 'unsafe-inline'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  // Enable WebAssembly to allow TikToken to accurately count tokens
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
  // PostHog rewrites for API and assets
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired
});

export default withMDX(config);
