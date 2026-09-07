import { INestApplication, ValidationPipe } from '@nestjs/common';

const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';

/**
 * Shared HTTP configuration for the real server (main.ts), the serverless
 * handler (serverless.ts) and the e2e tests, so all three run with identical
 * CORS and validation behaviour.
 */
export function configureApp(app: INestApplication) {
  app.enableCors({ origin: parseCorsOrigin(process.env.CORS_ORIGIN), credentials: true });

  // Every request body / query is validated against its DTO class:
  // - whitelist: strip unknown fields
  // - forbidNonWhitelisted: reject payloads containing unknown fields
  // - transform: build DTO instances and coerce query strings to numbers
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  return app;
}

/**
 * Turns the comma-separated CORS_ORIGIN variable into what `cors` expects.
 *
 * Entries may be exact origins ("https://reportflow.vercel.app"), `*` to allow
 * any origin, or contain a `*` wildcard in the host label. The wildcard form
 * exists for Vercel: every preview deployment gets its own generated hostname,
 * so "https://*.vercel.app" is the only practical way to keep previews working
 * without redeploying the API for each one.
 */
export function parseCorsOrigin(value?: string): boolean | (string | RegExp)[] {
  const patterns = (value ?? DEFAULT_CORS_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (patterns.length === 0) return [DEFAULT_CORS_ORIGIN];
  // `cors` compares plain strings with ===, so a literal "*" would never match;
  // `true` is its documented way of reflecting whatever origin asked.
  if (patterns.includes('*')) return true;

  return patterns.map((pattern) => (pattern.includes('*') ? wildcardToRegExp(pattern) : pattern));
}

/** "https://*.vercel.app" -> /^https:\/\/[^.]*\.vercel\.app$/i */
function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern
    // Escape every regex metacharacter except `*`, which is the wildcard.
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    // Match within one host label only, so "https://*.vercel.app" cannot be
    // satisfied by "https://anything.evil.com.vercel.app".
    .replace(/\*/g, '[^.]*');
  return new RegExp(`^${escaped}$`, 'i');
}
