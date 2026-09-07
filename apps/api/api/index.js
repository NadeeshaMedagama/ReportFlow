/**
 * Vercel Node.js function - the single entrypoint every API request lands on
 * (vercel.json rewrites `/(.*)` here, and Express routes it from there).
 *
 * This file is deliberately plain CommonJS that requires the *compiled* output
 * in ../dist. Vercel compiles function entrypoints with esbuild, and esbuild
 * does not implement `emitDecoratorMetadata` - bundling apps/api/src directly
 * would silently strip the `design:paramtypes` metadata NestJS reads for
 * constructor injection, and every provider would fail to resolve at runtime.
 *
 * `npm run vercel-build` runs `nest build` (tsc) first, so dist/serverless.js
 * already contains the emitted metadata as ordinary function calls that
 * esbuild can carry over untouched.
 */
const { bootstrapHandler } = require('../dist/serverless');

module.exports = async function handler(req, res) {
  const app = await bootstrapHandler();
  return app(req, res);
};
