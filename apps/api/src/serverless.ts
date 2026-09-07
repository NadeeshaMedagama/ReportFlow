import 'reflect-metadata';
import { INestApplication, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

/**
 * Serverless entrypoint (Vercel).
 *
 * main.ts owns the long-running server; this module owns the request-per-
 * invocation variant. Instead of `app.listen()` it calls `app.init()` and
 * hands back the underlying Express instance, which Vercel's Node runtime
 * invokes as a plain `(req, res)` handler.
 *
 * The bootstrapped app is cached in module scope so it survives for the life
 * of the warm container: a cold start pays the Nest bootstrap and the initial
 * Prisma connection once, every later request on that instance pays nothing.
 *
 * Loaded via apps/api/api/index.js, which requires the *compiled* dist/ build
 * rather than this source file - see that file for why that matters.
 */

/** Express's `(req, res)` signature, kept structural so express isn't a direct dependency. */
export type RequestListener = (req: unknown, res: unknown) => void;

let cached: Promise<RequestListener> | undefined;

async function create(): Promise<RequestListener> {
  const app: INestApplication = configureApp(await NestFactory.create(AppModule));

  // init() runs the same lifecycle as listen() (module init, global pipes and
  // guards, Prisma $connect) but never binds a port.
  await app.init();
  Logger.log('Nest application initialised for serverless', 'Bootstrap');

  return app.getHttpAdapter().getInstance() as RequestListener;
}

export function bootstrapHandler(): Promise<RequestListener> {
  // A failed bootstrap must not be cached, or one bad cold start (an
  // unreachable database, say) would poison every request on the instance.
  cached ??= create().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}
