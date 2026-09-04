# ReportFlow - Weekly Report Generator & Team Dashboard

A full-stack internal tool where team members submit a fixed-structure weekly work report, managers review it (approve or send it back with a comment), and a team dashboard gives managers submission tracking, filters, analytics and an optional AI assistant.

| Layer | Stack |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query, Recharts, Zod |
| Backend | NestJS 11, TypeScript, Prisma 6, JWT auth, class-validator |
| Database | PostgreSQL 16+ |
| AI (optional) | Anthropic Claude via `@anthropic-ai/sdk` with tool use |
| Tests | Jest unit tests + Supertest end-to-end tests (RBAC and the full review cycle) |
| CI/CD | GitHub Actions: CI, CodeQL, Dependabot, releases, Docker Hub, GitHub Packages, production deploy |

```
weekly-report-generator/
├── apps/api        NestJS REST API + Prisma schema, migrations, seed, tests
├── apps/web        Next.js frontend
├── packages/shared Enums, labels and API contract types shared with the web app
├── docs/           ER diagram, API reference, CI/CD guide, presentation outline
├── .github/        Workflows, Dependabot, issue and PR templates
├── action.yml      GitHub Marketplace action (weekly compliance check)
└── docker-compose.yml  PostgreSQL, plus the full stack under the `full` profile
```

---

## 1. Installing dependencies

Prerequisites: **Node.js 18.18+** (tested on Node 22/25), **npm 9+**, and **PostgreSQL 16+** (local install or Docker).

```bash
git clone <your-fork-url> weekly-report-generator
cd weekly-report-generator
npm install            # installs api, web and shared (npm workspaces)
```

## 2. Running the database

**Option A - Docker (recommended):**

```bash
docker compose up -d   # PostgreSQL 16 on localhost:5432, user/password postgres/postgres, db weekly_reports
```

**Option B - local PostgreSQL** (e.g. Homebrew on macOS):

```bash
createdb weekly_reports
```

Then create the API environment file and point `DATABASE_URL` at your database:

```bash
cp apps/api/.env.example apps/api/.env
# Docker:   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/weekly_reports?schema=public"
# Homebrew: DATABASE_URL="postgresql://<your-mac-username>@localhost:5432/weekly_reports?schema=public"
```

Apply the schema and load the demo data:

```bash
npm run db:migrate     # prisma migrate dev (creates the tables)
npm run db:seed        # 7 users, 5 projects, 8 weeks of reports in every status
```

Useful extras: `npm run db:studio` (Prisma Studio GUI), `npm run db:reset` (drop, migrate and re-seed).

## 3. Running the backend

```bash
npm run dev:api        # http://localhost:4000 (watch mode)
```

`apps/api/.env` variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign access tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `8h`) |
| `PORT` | API port (default `4000`) |
| `CORS_ORIGIN` | Allowed browser origin(s), comma separated |
| `ANTHROPIC_API_KEY` | Optional - enables the AI assistant |
| `ANTHROPIC_MODEL` | Optional - Claude model id (default `claude-opus-5`) |

## 4. Running the frontend

```bash
cp apps/web/.env.example apps/web/.env.local   # NEXT_PUBLIC_API_URL=http://localhost:4000
npm run dev:web        # http://localhost:3000
```

Or start both at once from the repository root: `npm run dev`.

### Demo accounts

Password for every seeded account: **`Password123!`**

| Role | Email | Name |
| --- | --- | --- |
| Admin | `admin@reportflow.dev` | Priya Nair |
| Manager | `manager@reportflow.dev` | Daniel Okafor |
| Team member | `ava@reportflow.dev` | Ava Silva |
| Team member | `noah@reportflow.dev` | Noah Perera |
| Team member | `maya@reportflow.dev` | Maya Fernando |
| Team member | `liam@reportflow.dev` | Liam Jayasuriya |
| Team member | `zoe@reportflow.dev` | Zoe Wickramasinghe |

The seed covers the last 8 weeks and includes drafts, reports awaiting review, reports sent back for correction, approved reports, late submissions, a member who skipped a week, and several correction cycles with two versions and multiple review comments.

## 5. Tests

```bash
npm test               # unit tests (guards + report authorization / workflow rules) - no database needed
npm run test:e2e       # boots the real API against DATABASE_URL and exercises RBAC + the full review cycle over HTTP
```

The e2e suite creates its own users (unique e-mails) and deletes everything it created. Set `TEST_DATABASE_URL` to run it against a separate database.

## 6. Production build

```bash
npm run build          # nest build + next build
npm run start:api      # node apps/api/dist/main.js
npm run start:web      # next start
```

---

## Features

### Roles and access control

| | Team member | Manager | Admin |
| --- | --- | --- | --- |
| Create / edit / submit own reports | yes | - | - |
| Read own reports, versions, comments | yes | - | - |
| Read every member's submitted reports | - | yes | yes |
| Approve / request changes | - | yes | yes |
| Team dashboard, analytics, side-by-side view, AI assistant | - | yes | yes |
| Project CRUD and member assignment | - | yes | yes |
| Invite users, change roles, deactivate accounts | - | - | yes |

Rules that are enforced on the server (and covered by tests):

- Every route requires a JWT unless marked `@Public()`; `@Roles(...)` metadata is checked by a global guard.
- Team members are always scoped to `userId = me` when listing reports; opening someone else's report returns 403.
- **Drafts are private**: managers see that a draft exists (status tracking) but cannot open its content.
- Managers can never modify report content - the `PATCH /reports/:id` route is restricted to team members and additionally checks ownership. Review actions only change status, comment and history.
- Self-service registration always creates a team member; only admins assign roles, and an admin cannot demote or deactivate themselves.

### Report structure (fixed for everyone)

1. Week (Monday-Sunday, one report per member per week)
2. Project / category
3. Tasks completed - table with name, priority, planned % vs actual %, status, planned vs spent hours, output
4. Tasks planned for next week
5. Blockers / challenges - one can be flagged as the key issue
6. Achievements / highlights - one can be flagged as the key achievement
7. Hours worked by task type (optional)
8. Notes / links (optional)

### Review and correction workflow

```
DRAFT --submit--> SUBMITTED --approve--> APPROVED
                     |  ^
        request changes  | resubmit (new version)
                     v  |
              NEEDS_CORRECTION
```

- Every submit / resubmit stores an immutable snapshot in `ReportVersion` (v1, v2, ...).
- Every decision is stored in `ReviewHistory` linked to the version it was made against, so a manager can see each past version alongside the one under review and which comment targeted which version.
- Requesting changes requires a comment; the team member sees it prominently on their report and on the edit page.

### Manager dashboard

- **Team reports**: all reports for a week or a date range, filtered by member, project and status; per-member submission status including *not started*, on-time/late/overdue timing; side-by-side view of one section (blockers, achievements, next-week plan, tasks) across the team.
- **Dashboard**: submissions vs pending, compliance rate with on-time/late breakdown, reports needing correction, open blockers; charts for tasks completed over time (team or per member), status by member, workload by project, time by task type; recent activity feed; AI team summary.
- **Team** and **member profile** pages with stats (approval rate, on-time rate, average hours, correction cycles) and full history.

### Pages

Login, Register, My reports (history), New report, Edit report, Report detail (read-only, with versions and comments), Manager review, Team reports, Dashboard, Team, Team member profile, Projects, Users (admin), Settings.

### AI assistant (optional)

Set `ANTHROPIC_API_KEY` in `apps/api/.env`. Managers then get a floating chat widget ("Who hasn't submitted this week?", "What did the team work on last week?") and a "Generate summary" button on the dashboard. The model never touches the database directly: it can only call four read-only tools (`list_team_members`, `list_projects`, `get_week_overview`, `get_reports`) implemented in `apps/api/src/assistant`. Drafts are never exposed, e-mail addresses are never sent, and nothing is stored - the client sends the conversation each turn. See `docs/PRESENTATION.md` for prompt design and privacy notes.

---

## API overview

All routes are JSON, prefixed by nothing (`http://localhost:4000/...`), and expect `Authorization: Bearer <token>` except `POST /auth/register`, `POST /auth/login` and `GET /health`. Full reference: [`docs/API.md`](docs/API.md).

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/me`, `POST /auth/change-password` |
| Reports | `GET /reports` (paginated + filters), `POST /reports`, `GET/PATCH/DELETE /reports/:id`, `POST /reports/:id/submit`, `POST /reports/:id/review`, `GET /reports/:id/versions`, `GET /reports/:id/versions/:versionId`, `GET /reports/:id/reviews` |
| Projects | `GET /projects`, `GET /projects/:id`, `POST /projects`, `PATCH /projects/:id`, `PUT /projects/:id/members`, `DELETE /projects/:id` |
| Users | `GET /users`, `GET /users/:id` (profile + stats), `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` |
| Dashboard | `GET /dashboard/summary`, `submission-status`, `tasks-trend`, `status-by-member`, `workload-by-project`, `time-by-category`, `activity`, `section-overview` |
| Assistant | `GET /assistant/status`, `POST /assistant/chat`, `POST /assistant/team-summary` |

## Database

Prisma schema: [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma). ER diagram: [`docs/er-diagram.png`](docs/er-diagram.png) (image), [`docs/ER-DIAGRAM.md`](docs/ER-DIAGRAM.md) (Mermaid source and design notes).

Entities: `User` (role), `Project`, `ProjectMember`, `Report`, `ReportTask`, `Blocker`, `Achievement`, `HoursEntry`, `ReportVersion` (immutable JSON snapshot per submission), `ReviewHistory` (decision + comment linked to a version), `ActivityLog`.

## CI/CD and automation

Ten GitHub Actions workflows cover the repository: CI (type-check, build, unit
and end-to-end tests, Docker builds), CodeQL, Copilot code review, dependency
review with `npm audit`, Dependabot with auto-merge for safe updates, releases,
publishing to Docker Hub and GitHub Packages, production deployment, and the
GitHub Marketplace action defined by `action.yml`.

Full details, required secrets and the one-time repository setup are in
[`docs/CI-CD.md`](docs/CI-CD.md).

### Running the stack in containers

```bash
docker compose --profile full up --build
# seed demo data from the host once the database is healthy
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/weekly_reports?schema=public" npm run db:seed
```

If something already uses port 5432, start with `DB_PORT=5433 docker compose --profile full up --build`
and use that port in the seed command.

## Deployment notes

Split deployment works well: the API on Render / Railway / Fly with a managed PostgreSQL (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` = web URL, run `npx prisma migrate deploy` then `npm run start:api`), the web app on Vercel with `NEXT_PUBLIC_API_URL` pointing at the API.
