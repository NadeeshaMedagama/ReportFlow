# CI/CD and repository automation

Everything here lives in `.github/`. Ten workflows cover testing, security,
dependency maintenance, releases and publishing.

| Workflow | File | Trigger | What it does |
| --- | --- | --- | --- |
| CI | `ci.yml` | push/PR to `main` | Type-check, build, unit tests, end-to-end tests against PostgreSQL, Docker image builds |
| CodeQL | `codeql.yml` | push/PR, weekly | Static security analysis of the TypeScript sources and the workflow files |
| Copilot code review | `copilot-code-review.yml` | PR opened/updated | Requests an automated Copilot review on the pull request |
| Dependency review | `dependency-review.yml` | PR | Blocks vulnerable or copyleft dependencies, runs `npm audit`, checks the lockfile is in sync |
| Dependabot auto-merge | `dependabot-auto-merge.yml` | Dependabot PRs | Approves and auto-merges safe updates, flags production majors |
| Release | `release.yml` | version tag, manual | Verifies the tag, builds artifacts, publishes a GitHub release with a changelog |
| Docker Hub | `docker-publish.yml` | push to `main`, tags | Multi-arch images pushed to Docker Hub |
| GitHub Packages | `github-packages.yml` | push, tags, release | Images to `ghcr.io`, `@weekly-report/shared` to the npm registry |
| Deploy production | `deploy-production.yml` | release published, manual | Applies migrations, rolls out API then web, health-checks both |
| Marketplace | `publish-marketplace.yml` | action changes, release | Validates and tests `action.yml`, moves the `v1` tag |

Dependabot itself is configured in `.github/dependabot.yml`.

## The pipeline end to end

```
pull request ──> CI (typecheck, build, unit, e2e, docker)
             ├─> CodeQL
             ├─> Dependency review + npm audit
             └─> Copilot code review
                        │
                     merge to main
                        │
             ├─> Docker Hub  (tag: edge)
             └─> ghcr.io     (tag: edge)
                        │
                  git tag v1.2.3
                        │
                     Release (verify, artifacts, changelog, GitHub release)
                        │
             ├─> Docker Hub + ghcr.io (v1.2.3, v1.2, latest)
             ├─> @weekly-report/shared to GitHub Packages
             ├─> Marketplace action: v1 moved to v1.2.3
             └─> Deploy production (migrations, rollout, health checks)
```

## One-time repository setup

**Secrets** (Settings > Secrets and variables > Actions):

| Secret | Needed by | Notes |
| --- | --- | --- |
| `DOCKERHUB_USERNAME` | Docker Hub publish | Account or organisation name |
| `DOCKERHUB_TOKEN` | Docker Hub publish | Access token with Read/Write scope |

`GITHUB_TOKEN` is provided automatically and covers ghcr.io, GitHub Packages,
releases and Dependabot auto-merge.

**Variables** (optional):

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DOCKERHUB_NAMESPACE` | Docker Hub publish | Defaults to `DOCKERHUB_USERNAME` |
| `PUBLIC_API_URL` | image builds | Baked into the web image at build time |
| `PRODUCTION_API_URL` | deploy | Health check target |
| `PRODUCTION_WEB_URL` | deploy | Smoke check target and environment URL |

**Production environment** (Settings > Environments > `production`): add
required reviewers, then set the secrets `PRODUCTION_DATABASE_URL`,
`DEPLOY_WEBHOOK_URL` and `DEPLOY_WEBHOOK_URL_WEB` (deploy hooks from Render,
Railway, Fly or similar).

**Repository settings to enable:**

- Allow auto-merge (Settings > General) - required by Dependabot auto-merge
- Branch protection on `main` requiring the **CI passed** status check
- Copilot code review (Settings > Copilot), if your plan includes it
- Read and write permissions for `GITHUB_TOKEN` (Settings > Actions > General)

## The dependency audit gate

`npm audit --audit-level=high` is all-or-nothing: a single unfixable transitive
advisory turns the gate permanently red, and the usual reaction is to lower the
threshold, which then hides the next real problem. `scripts/audit-check.mjs`
keeps the gate meaningful instead. It fails on any high-severity advisory that
is **not** listed in `.github/audit-allowlist.json`, where each accepted finding
carries the chain that introduced it, why it is not exploitable here, and a
`reviewBy` date. An expired entry fails the build, and an entry that no longer
matches anything is reported as stale so the list cannot quietly rot. A registry
call that returns no usable report is retried and then fails, rather than
passing as "no vulnerabilities".

Two chains are currently accepted, both build-time and neither reachable from a
request:

| Advisory | Chain | Why it is accepted | Fix |
| --- | --- | --- | --- |
| `deepmerge-ts` stack exhaustion | `prisma` > `@prisma/config` > `deepmerge-ts` | The Prisma CLI reads our own committed config during migrations and client generation; no untrusted input reaches it | Prisma 7 (major) |
| `postcss` sourceMappingURL / stringify advisories | `next` > `postcss` | PostCSS runs at build time over first-party CSS; the advisories need attacker-controlled CSS | Next.js 16 (major) |

Both are scheduled for review by 2026-12-31. Take the major upgrades
deliberately, with the full test suite as the check, rather than as an
`npm audit fix --force`.

Run the gate locally with:

```bash
node scripts/audit-check.mjs --production --level=high
```

Note that `prisma` is a production dependency rather than a development one,
because the API image runs `prisma migrate deploy` on start.

## Releasing

```bash
git tag v1.0.0
git push origin v1.0.0
```

The release workflow re-runs the full test suite against a fresh database
before publishing, so a tag that fails verification never produces a release.
You can also run it manually from the Actions tab with a version input, which
creates the tag for you.

## Container images

Both apps ship as multi-architecture images (`linux/amd64`, `linux/arm64`) with
build provenance and an SBOM attached.

```bash
docker pull ghcr.io/<owner>/<repo>/api:latest
docker pull ghcr.io/<owner>/<repo>/web:latest
```

Run the whole stack locally:

```bash
docker compose --profile full up --build
# then seed demo data from the host:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/weekly_reports?schema=public" npm run db:seed
```

`NEXT_PUBLIC_API_URL` is inlined into the web bundle at build time, so pass the
public API URL as a build argument when building an image for a real
deployment. The API image runs `prisma migrate deploy` on start; set
`RUN_MIGRATIONS=false` when a deploy job applies migrations instead.

## The Marketplace action

The repository doubles as a GitHub Action. `action.yml` at the root defines a
weekly compliance check that any repository can run against a ReportFlow
instance:

```yaml
name: Weekly report reminder
on:
  schedule:
    - cron: "0 9 * * 2"   # Tuesday morning
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - id: reports
        uses: <owner>/<repo>@v1
        with:
          api-url: https://reports.example.com
          email: ${{ secrets.REPORTFLOW_EMAIL }}
          password: ${{ secrets.REPORTFLOW_PASSWORD }}
          minimum-compliance: "80"
      - run: echo "Compliance ${{ steps.reports.outputs.compliance-rate }}%"
```

It writes a per-member table to the job summary and exposes `compliance-rate`,
`submitted`, `pending`, `awaiting-review`, `needs-correction`, `open-blockers`,
`missing-members` and `week-label` as outputs. Set `minimum-compliance` or
`fail-on-missing` to turn the check into a failing step.

Publishing to the Marketplace is a one-time manual step: draft a release in the
GitHub UI and tick "Publish this Action to the GitHub Marketplace". After that,
`publish-marketplace.yml` keeps the `v1` tag pointing at the newest release.

## Running the checks locally

```bash
npm run typecheck
npm test
npm run test:e2e
npm audit --omit=dev --audit-level=high

# Lint the workflows the way CI does
brew install actionlint && actionlint

# Build the images CI builds
docker build -f apps/api/Dockerfile -t reportflow-api .
docker build -f apps/web/Dockerfile -t reportflow-web .
```
