# Presentation outline (Google Slides)

Suggested 12-14 slides. Speaker notes in *italics*.

## 1. Title
ReportFlow - Weekly Report Generator & Team Dashboard. Name, date, repo link.

## 2. The problem and the solution
Team members submit one structured report per week; managers review, send back or approve; a dashboard gives the whole-team picture. *Emphasise the review cycle and fixed structure - the two things the assignment stresses.*

## 3. System architecture
```
Browser ──> Next.js 15 (App Router, React 19, Tailwind, TanStack Query, Recharts)
              │  JSON + Bearer JWT
              ▼
           NestJS 11 REST API ── Prisma 6 ──> PostgreSQL
              │
              └──> Anthropic Claude (optional, tool use, read-only)
```
Monorepo: `apps/api`, `apps/web`, `packages/shared` (enums + API contract types). *Why: one language end to end, typed contract shared between client and server.*

## 4. Database design
Show `docs/ER-DIAGRAM.md`. Key decisions:
- Fixed sections are typed child tables, not free JSON -> comparable across the team.
- `Report` = live editable row; `ReportVersion` = immutable snapshot per submission; `ReviewHistory` links each decision to the version it targeted.
- Unique `(userId, weekStart)`; weeks are Mondays.
- Soft deletes for users and projects so history survives.

## 5. Role-based access control
- Global `JwtAuthGuard` (every route protected unless `@Public()`) + `RolesGuard` reading `@Roles()` metadata.
- Ownership rules live in `ReportsService` (`assertCanView`, `assertOwner`, `assertEditable`) and are unit tested.
- Drafts are private to their author; managers only see a status.
- Managers can never change content: `PATCH /reports/:id` is team-member-only and ownership-checked; review only writes status/comment/history.
- Demo the e2e test output: 12 HTTP-level assertions incl. member -> other member 403, member -> dashboard 403, manager -> PATCH 403.

## 6. API design
Resource-oriented REST: `/auth`, `/reports`, `/projects`, `/users`, `/dashboard`, `/assistant`. DTO validation with class-validator (`whitelist` + `forbidNonWhitelisted`). Pagination + filters on `GET /reports`. Server computes a `permissions` object per report so the UI never guesses. Controllers are thin; services hold the rules.

## 7. Review / correction workflow
State machine: DRAFT -> SUBMITTED -> (APPROVED | NEEDS_CORRECTION -> SUBMITTED ...).
`submit()` runs in a transaction: snapshot -> `ReportVersion` n+1 -> status. `review()` records `ReviewHistory` against the latest version. Show the version modal and the timeline in the UI. *Walk through one real cycle from the seed (Maya, two weeks ago: v1 sent back, v2 approved).*

## 8. Frontend structure
- `app/(auth)` login/register; `app/(app)` everything behind `AppShell` (role-aware nav).
- Personal report page (`ReportForm`: fixed sections, zod validation, draft vs submit rules) vs report history (`/my-reports`) vs team dashboard (`/team-reports`, `/dashboard`).
- Reusable pieces: `ReportView` renders both the live report and any past snapshot; `ReportTable` used by history, team reports and profile; UI kit in `components/ui`.
- Data layer: `lib/api/*` typed fetchers -> `lib/hooks/*` TanStack Query hooks -> pages.

## 9. Dashboard and insights
Metrics (submitted/pending, compliance with on-time/late, needs correction, open blockers), charts (tasks trend team/per-member, status by member, workload by project, time by category), activity feed, side-by-side section view, member profiles. Colour rules: fixed hue per entity, status colours reserved, every chart has a table fallback.

## 10. AI assistant (bonus)
- Claude with function calling: 4 read-only tools built on Prisma (`list_team_members`, `list_projects`, `get_week_overview`, `get_reports`).
- System prompt: answer only from tool data, current/last week dates injected, concise markdown.
- Privacy: manager-only endpoint, drafts excluded, no e-mails, nothing persisted, key stays server-side, tool outputs capped at 25 reports.
- Team summary endpoint gathers the week's data server-side and asks for four fixed headings.

## 11. Testing
28 unit tests (guards, report authorization + workflow) and 12 e2e tests through HTTP with a real database. Seed script produces a deterministic realistic dataset (8 weeks, 37 reports, 7 multi-version cycles).

## 12. Challenges and how they were solved
- Week semantics across timezones -> weeks stored as date-only Mondays, normalised on the server.
- Keeping past versions readable -> JSON snapshot rendered by the same `ReportView` component as live reports.
- "Not started" members on the dashboard -> derived by joining active members against the week's reports.
- Late detection -> `firstSubmittedAt` vs a computed deadline (end of the Monday after the week).
- Booleans in query strings with implicit conversion -> explicit `ToBoolean` transform.

## 13. Future improvements
Notifications (email/Slack on send-back), report templates per team, export to PDF/CSV, refresh tokens + HTTP-only cookies, OpenAPI docs, diff view between versions, RAG over long histories, deployment pipeline.

## 14. Demo
Login as Ava -> create report -> submit. Login as Daniel -> team reports -> review -> request changes. Back as Ava -> comment visible -> edit -> resubmit (v2). Daniel approves, shows versions and comments. Then dashboard, filters, side-by-side blockers, profile pages, projects, users, AI assistant.
