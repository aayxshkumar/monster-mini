import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**", pathname: "/**" },
    ],
  },
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG ?? "archivio",
      project: process.env.SENTRY_PROJECT ?? "archivio-share",
      silent: !process.env.CI,
    })
  : nextConfig;
