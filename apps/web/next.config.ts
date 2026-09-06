import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (set by apps/web/Dockerfile).
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  // The shared package is plain TypeScript, so Next.js compiles it.
  transpilePackages: ['@weekly-report/shared'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
