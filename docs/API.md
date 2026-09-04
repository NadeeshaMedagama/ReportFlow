# API reference

Base URL: `http://localhost:4000`. Every route except `POST /auth/register`, `POST /auth/login` and `GET /health` requires `Authorization: Bearer <accessToken>`.

Validation errors return `400` with `{ "message": ["field must ...", ...] }`. Authorization failures return `401` (no/invalid token) or `403` (wrong role or not the owner). Missing resources return `404`, conflicts (duplicate week / email / project name) return `409`.

## Auth

| Method | Route | Body | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password, jobTitle? }` | Creates a TEAM_MEMBER, returns `{ accessToken, user }` |
| POST | `/auth/login` | `{ email, password }` | Returns `{ accessToken, user }` |
| GET | `/auth/me` | | Current user |
| PATCH | `/auth/me` | `{ name?, jobTitle? }` | Update own profile |
| POST | `/auth/change-password` | `{ currentPassword, newPassword }` | |

Password rule: at least 8 characters with a letter and a number.

## Reports

| Method | Route | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/reports` | all | Paginated list. Query: `page`, `limit` (max 100), `status`, `projectId`, `weekStart` (Monday) or `from`/`to`, `memberId` (managers only - members are always scoped to themselves). Each item carries a `permissions` object. |
| POST | `/reports` | TEAM_MEMBER | Create a draft. Body = report payload (below). `409` if a report for that week exists. |
| GET | `/reports/:id` | owner, managers (non-draft) | Full report with tasks, blockers, achievements, hours, version list and review history |
| PATCH | `/reports/:id` | owner | Replace the content. Allowed in DRAFT and NEEDS_CORRECTION only. The week is locked after the first submission. |
| DELETE | `/reports/:id` | owner | Drafts only |
| POST | `/reports/:id/submit` | owner | DRAFT/NEEDS_CORRECTION -> SUBMITTED, creates `ReportVersion` n+1. Requires at least one task and a next-week plan. |
| POST | `/reports/:id/review` | MANAGER, ADMIN | `{ decision: "APPROVE" \| "REQUEST_CHANGES", comment? }`. Comment mandatory for REQUEST_CHANGES. SUBMITTED only. |
| GET | `/reports/:id/versions` | owner, managers | Versions (newest first) with the decisions made on each |
| GET | `/reports/:id/versions/:versionId` | owner, managers | One version with its JSON `snapshot` |
| GET | `/reports/:id/reviews` | owner, managers | Review history (newest first) with reviewer and version number |

Report payload:

```json
{
  "weekStart": "2026-08-31",
  "projectId": "…",
  "tasks": [
    { "name": "Implement onboarding flow", "priority": "HIGH", "status": "COMPLETED",
      "plannedPercent": 100, "actualPercent": 100, "plannedHours": 8, "actualHours": 9.5, "output": "PR #412 merged" }
  ],
  "nextWeekPlan": "Finish offline caching; start push notifications.",
  "blockers": [{ "description": "Waiting on API contract", "isKey": true }],
  "achievements": [{ "description": "Shipped onboarding", "isKey": true }],
  "hours": [{ "category": "DEVELOPMENT", "hours": 22 }, { "category": "MEETINGS", "hours": 4 }],
  "notes": "Out of office Friday afternoon",
  "links": "https://github.com/org/repo/pull/412"
}
```

Enums: priority `LOW|MEDIUM|HIGH|CRITICAL`; task status `NOT_STARTED|IN_PROGRESS|COMPLETED|BLOCKED`; category `DEVELOPMENT|TESTING|MEETINGS|DOCUMENTATION|DESIGN|SUPPORT|OTHER`. At most one blocker and one achievement may have `isKey: true`.

## Projects

| Method | Route | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/projects` | all | Active projects with members and report counts. Managers may pass `includeInactive=true`. |
| GET | `/projects/:id` | all | |
| POST | `/projects` | MANAGER, ADMIN | `{ name, description?, memberIds? }` |
| PATCH | `/projects/:id` | MANAGER, ADMIN | `{ name?, description?, active?, memberIds? }` |
| PUT | `/projects/:id/members` | MANAGER, ADMIN | `{ memberIds: [] }` replaces the assignment |
| DELETE | `/projects/:id` | MANAGER, ADMIN | Hard delete if unused, otherwise archived. Returns `{ id, archived }`. |

## Users

| Method | Route | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/users` | MANAGER, ADMIN | Query: `role`, `search`, `includeInactive` |
| GET | `/users/:id` | MANAGER, ADMIN | Profile: user, stats (approval rate, on-time rate, hours, correction cycles), 8-week series |
| POST | `/users` | ADMIN | Invite: `{ name, email, password, role, jobTitle? }` |
| PATCH | `/users/:id` | ADMIN | `{ name?, jobTitle?, role?, active? }` - cannot change own role or deactivate self |
| DELETE | `/users/:id` | ADMIN | Deactivates (soft delete) |

## Dashboard (MANAGER, ADMIN)

| Route | Query | Returns |
| --- | --- | --- |
| `GET /dashboard/summary` | `weekStart?` | members, submitted, on time, late, pending, not started, compliance rate, counts by status, awaiting review, needs correction (week + total), open/key blockers |
| `GET /dashboard/submission-status` | `weekStart?` | one row per active member with status (`NOT_STARTED` included) and timing (`ON_TIME`, `LATE`, `PENDING`, `OVERDUE`) |
| `GET /dashboard/tasks-trend` | `weeks?` (1-26, default 8) | per-week completed tasks, team total and per member series |
| `GET /dashboard/status-by-member` | `weeks?` | report status counts per member |
| `GET /dashboard/workload-by-project` | `weeks?` | hours, tasks, people and reports per project |
| `GET /dashboard/time-by-category` | `weeks?` | hours per work category with share |
| `GET /dashboard/activity` | `limit?` | recent submissions, reviews and admin actions with a readable message |
| `GET /dashboard/section-overview` | `section=BLOCKERS\|ACHIEVEMENTS\|NEXT_WEEK\|TASKS`, `weekStart?` | one section across all submitted reports of the week |

Reports are due by the end of the Monday after the reporting week; a report first submitted after that is *late*.

## Assistant (MANAGER, ADMIN)

| Method | Route | Body | Notes |
| --- | --- | --- | --- |
| GET | `/assistant/status` | | `{ enabled, model }` |
| POST | `/assistant/chat` | `{ messages: [{ role: "user"\|"assistant", content }] }` | Returns `{ reply, toolsUsed, stopReason }`. `503` when not configured. |
| POST | `/assistant/team-summary` | `{ weekStart? }` | Markdown summary of the week |
