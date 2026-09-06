// Allows the e2e suite to target a dedicated database:  TEST_DATABASE_URL=... npm run test:e2e
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
