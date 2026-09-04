import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * Shared HTTP configuration for the real server (main.ts) and the e2e tests,
 * so both run with identical CORS and validation behaviour.
 */
export function configureApp(app: INestApplication) {
  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

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
