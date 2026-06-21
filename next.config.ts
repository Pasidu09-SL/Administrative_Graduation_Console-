import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  allowedDevOrigins: [
    'chastity-frostlike-unstitch.ngrok-free.dev',
    '*.ngrok-free.dev'
  ],
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
