// Allows the e2e suite to target a dedicated database:  TEST_DATABASE_URL=... npm run test:e2e
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// The Prisma schema declares a directUrl, which the CLI refuses to run without.
// The tests never migrate through a pooler, so mirroring DATABASE_URL is right.
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
