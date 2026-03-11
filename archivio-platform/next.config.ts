import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from Supabase storage and Pi server
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "http", hostname: "**.local" },
    ],
  },
};

export default nextConfig;
