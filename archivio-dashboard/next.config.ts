import type { NextConfig } from "next";
import path from "path";

// Force this directory as the only project root so module resolution uses our node_modules
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: projectRoot,
  },
  // Ensure Node resolves modules from dashboard's node_modules first (fixes "Can't resolve lucide-react/sonner")
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.modules = [path.join(projectRoot, "node_modules"), ...(config.resolve.modules ?? [])];
    return config;
  },
};

export default nextConfig;
