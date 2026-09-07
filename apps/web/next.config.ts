import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * Origin of the NestJS API deployment, e.g. https://reportflow-api.vercel.app.
 *
 * Server-side only, so it is never baked into the client bundle and can be
 * changed by redeploying rather than rebuilding. It is only needed when the
 * browser reaches the API through this app (see the rewrite below).
 */
const apiOrigin = process.env.API_ORIGIN?.trim().replace(/\/+$/, '');

/**
 * A relative NEXT_PUBLIC_API_URL ("/api") means the browser calls this app and
 * the rewrite forwards to the API; an absolute one means it calls the API
 * directly. Local development and the Docker image use the absolute form.
 */
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const proxiesApi = Boolean(publicApiUrl) && !/^https?:\/\//i.test(publicApiUrl!);

if (proxiesApi && !apiOrigin) {
  // Failing the build here turns what would otherwise be a pile of confusing
  // 404s at runtime into one actionable message.
  throw new Error(
    `NEXT_PUBLIC_API_URL is "${publicApiUrl}", so API calls are routed through this app, ` +
      'but API_ORIGIN is unset and there is nothing to forward them to. ' +
      'Set API_ORIGIN to the API deployment URL (e.g. https://reportflow-api.vercel.app), ' +
      'or set NEXT_PUBLIC_API_URL to that URL to call the API directly.',
  );
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Self-contained server bundle for the Docker image (set by apps/web/Dockerfile).
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  // The shared package is plain TypeScript, so Next.js compiles it.
  transpilePackages: ['@weekly-report/shared'],
  outputFileTracingRoot: path.join(__dirname, '../../'),

  /**
   * Same-origin proxy to the API. Vercel resolves these at the routing layer,
   * so requests are not billed as extra function invocations, and because the
   * browser only ever talks to its own origin there is no CORS preflight and
   * every preview deployment works without listing its generated hostname on
   * the API.
   */
  async rewrites() {
    if (!apiOrigin) return [];
    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
  },
};

export default nextConfig;
