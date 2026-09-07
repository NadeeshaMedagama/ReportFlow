# Deploying ReportFlow to Vercel

This repository deploys as **two Vercel projects from the same Git repository**,
backed by a **Neon** PostgreSQL database.

```
                 browser
                    │
                    │  https://reportflow.vercel.app
                    ▼
      ┌──────────────────────────────┐
      │  Vercel project: reportflow  │   Root Directory: apps/web
      │  Next.js 15 (App Router)     │   NEXT_PUBLIC_API_URL=/api
      └──────────────┬───────────────┘
                     │  /api/:path*  ──rewrite──▶  API_ORIGIN/:path*
                     ▼
    ┌────────────────────────────────────┐
    │  Vercel project: reportflow-api    │   Root Directory: apps/api
    │  NestJS 11 as a serverless function│   maxDuration 60s
    └──────────────┬─────────────────────┘
                   │  DATABASE_URL (pooled)
                   ▼
            Neon PostgreSQL
```

**Why the rewrite?** The browser only ever talks to its own origin, so there is
no CORS preflight and every preview deployment works without registering its
generated hostname on the API. Vercel resolves rewrites at the routing layer,
so the hop is not billed as an extra function invocation.

---

## 1. Create the database (Neon)

From the Vercel dashboard: **Storage → Create Database → Neon**, or sign up at
[neon.tech](https://neon.tech). Once created, copy **two** connection strings
from the Neon dashboard:

| Neon calls it | Used as | Shape |
| --- | --- | --- |
| **Pooled connection** | `DATABASE_URL` | host contains `-pooler` |
| **Direct connection** | `DIRECT_URL` | host has no `-pooler` |

Append Prisma's serverless parameters to the **pooled** string:

```
postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1
```

`pgbouncer=true` stops Prisma using prepared statements, which a transaction-mode
pooler cannot hold across statements. `connection_limit=1` keeps each function
instance to a single connection — serverless scales out horizontally, so a
larger per-instance pool exhausts the database's slots rather than helping.

The direct string is used only by Prisma Migrate, which cannot run through a
pooler. Leave it unmodified.

---

## 2. Apply migrations and seed

Run this once from your machine, before the first deployment, using the
**direct** connection for both variables:

```bash
DATABASE_URL="<neon direct url>" DIRECT_URL="<neon direct url>" npm run db:deploy
DATABASE_URL="<neon direct url>" DIRECT_URL="<neon direct url>" npm run db:seed
```

`db:seed` creates the seven demo accounts (password `Password123!`). Skip it for
a genuinely empty production database.

Later schema changes go out through `.github/workflows/deploy-production.yml`,
which reads `PRODUCTION_DATABASE_URL` and `PRODUCTION_DIRECT_URL` from the
`production` environment.

---

## 3. Deploy the API project

The web project needs the API's URL, so create this one first.

**New Project → import this repository**, then:

| Setting | Value |
| --- | --- |
| Project Name | `reportflow-api` |
| Root Directory | `apps/api` |
| Framework Preset | Other |

Leave the build and install commands alone — `apps/api/vercel.json` sets them
(`npm run vercel-build`, which is `prisma generate && nest build`).

Environment variables (Production, Preview and Development):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** URL with `pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Neon **direct** URL |
| `JWT_SECRET` | a long random string — `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | `8h` |
| `CORS_ORIGIN` | `https://reportflow.vercel.app,https://*.vercel.app` |
| `ANTHROPIC_API_KEY` | *optional* — enables the AI assistant |
| `ANTHROPIC_MODEL` | *optional* — defaults to `claude-opus-5` |

Deploy, then check the health endpoint:

```bash
curl https://reportflow-api.vercel.app/health
# {"status":"ok","service":"weekly-report-api","time":"..."}
```

Opening the URL in a browser shows a small landing page listing the endpoints.

> `CORS_ORIGIN` is not used by the proxied path — those requests are same-origin —
> but it keeps the API usable directly from a browser, from Postman with an
> `Origin` header, and from preview deployments if you ever bypass the proxy. A
> `*` may be used as a wildcard within one host label; `*` on its own allows any
> origin.

---

## 4. Deploy the web project

**New Project → import the same repository again**, then:

| Setting | Value |
| --- | --- |
| Project Name | `reportflow` |
| Root Directory | `apps/web` |
| Framework Preset | Next.js (auto-detected) |

Environment variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | `/api` |
| `API_ORIGIN` | `https://reportflow-api.vercel.app` |

`NEXT_PUBLIC_API_URL` is inlined into the client bundle at build time, so
changing it needs a rebuild. `API_ORIGIN` is read by `next.config.ts` on the
server only and never reaches the browser.

If `NEXT_PUBLIC_API_URL` is relative and `API_ORIGIN` is missing, the build
fails with an explicit message rather than shipping an app that 404s on every
request.

---

## 5. Verify

```bash
curl https://reportflow.vercel.app/api/health     # proxied through the web app
```

Then sign in at `https://reportflow.vercel.app/login` with `admin@reportflow.dev`
/ `Password123!` and confirm the dashboard charts load.

---

## How the NestJS app runs as a function

`apps/api/api/index.js` is the single entrypoint; `vercel.json` rewrites
`/(.*)` to it and Express routes from there. `src/serverless.ts` calls
`app.init()` instead of `app.listen()` and returns the Express instance, caching
the bootstrapped app in module scope so only a cold start pays for it.

**The entrypoint deliberately requires `../dist`, not `../src`.** Vercel compiles
function entrypoints with esbuild, which does not implement
`emitDecoratorMetadata`. Bundling the decorated sources directly would silently
strip the `design:paramtypes` metadata NestJS reads for constructor injection,
and every provider would fail to resolve at runtime. `vercel-build` runs
`nest build` (tsc) first, so the metadata is already emitted as ordinary
function calls that esbuild carries over untouched.

---

## Operational notes

- **Cold starts.** A cold invocation pays the Nest bootstrap plus the first
  Prisma connection — roughly 1–2s. Warm requests are single-digit milliseconds.
- **Function duration.** `maxDuration` is 60s in `apps/api/vercel.json`, the
  Hobby ceiling. The assistant keeps itself inside that with
  `ASSISTANT_REQUEST_TIMEOUT_MS` (45s per Claude call) and `ASSISTANT_BUDGET_MS`
  (50s for the whole tool-use loop), returning a real message instead of being
  killed mid-request. On Pro you can raise all three.
- **Prisma engine.** `schema.prisma` declares `binaryTargets = ["native",
  "rhel-openssl-3.0.x"]`; the second is the query engine for Vercel's Amazon
  Linux 2023 runtime. `prisma generate` runs in the build because Vercel caches
  `node_modules` and would otherwise ship a stale client.
- **Both projects rebuild on every push.** To skip unrelated builds, set an
  Ignored Build Step on each project — for the API:
  `git diff --quiet HEAD^ HEAD -- apps/api package-lock.json`.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Cannot resolve dependency ... at index [0]` | The function is bundling `src` instead of `dist`. Check that `api/index.js` requires `../dist/serverless` and that `vercel-build` ran. |
| `Error validating datasource: the URL must start with postgresql://` | `DIRECT_URL` is unset. It is required by the schema whenever Prisma Migrate runs. |
| `prepared statement "s0" already exists` | The pooled URL is missing `pgbouncer=true`. |
| `too many connections` | `connection_limit=1` is missing, or `DATABASE_URL` points at the direct connection instead of the pooled one. |
| `Query engine library for current platform could not be found` | `prisma generate` did not run in the build, or `binaryTargets` lost `rhel-openssl-3.0.x`. |
| Login works locally, 404s on Vercel | `API_ORIGIN` points somewhere wrong, or `NEXT_PUBLIC_API_URL` was changed without redeploying the web project. |
| CORS error in the browser console | The app is bypassing the proxy — `NEXT_PUBLIC_API_URL` is absolute. Either set it to `/api`, or add the web origin to `CORS_ORIGIN`. |
| Assistant returns 504 | Claude took longer than the function budget. Lower `ASSISTANT_BUDGET_MS`, or raise `maxDuration` on Pro. |

---

## Docker is unaffected

`docker compose --profile full up --build` still runs the whole stack locally.
`main.ts` remains the container entrypoint; `serverless.ts` is additive, and the
Docker entrypoint defaults `DIRECT_URL` to `DATABASE_URL` when it is not set.
