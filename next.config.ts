import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Tauri - use static export
  output: "export",

  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },

  // Ensure trailing slashes for static files
  trailingSlash: true,
};

export default nextConfig;
