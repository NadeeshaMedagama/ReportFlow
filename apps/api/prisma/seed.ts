/**
 * Demo data seed.
 *
 * Creates 1 admin, 1 manager, 5 team members, 5 projects and 8 weeks of reports
 * in every status - including several correction cycles with multiple versions
 * and review comments - so the dashboard, history and review pages are
 * meaningful out of the box. Deterministic: the same data is produced on every run.
 *
 * Run with: npm run db:seed
 */
import {
  ActivityType,
  PrismaClient,
  ReportStatus,
  ReviewAction,
  Role,
  TaskPriority,
  TaskStatus,
  WorkCategory,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { addDays, addWeeks, currentWeekStart, endOfWeek, formatWeekLabel } from '../src/common/week';
import { buildSnapshot, snapshotToJson } from '../src/reports/report-snapshot';

const prisma = new PrismaClient();

export const DEMO_PASSWORD = 'Password123!';
const WEEKS_OF_HISTORY = 8;

// ---------------------------------------------------------------------------
// Deterministic pseudo random helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260903);
const between = (min: number, max: number) => min + rand() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
function pickMany<T>(items: readonly T[], count: number): T[] {
  const copy = [...items];
  const out: T[] = [];
  while (out.length < count && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

const now = new Date();
/** Seed data must never live in the future (e.g. when seeding on a Monday). */
const clampPast = (date: Date) => (date.getTime() > now.getTime() ? new Date(now.getTime() - 60_000) : date);
const atHour = (date: Date, hour: number, minute = 0) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute));
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 3_600_000);

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

type UserKey = 'admin' | 'manager' | 'ava' | 'noah' | 'maya' | 'liam' | 'zoe';
type ProjectKey = 'clientA' | 'tooling' | 'rnd' | 'marketing' | 'platform';

const USERS: Array<{ key: UserKey; name: string; email: string; role: Role; jobTitle: string }> = [
  { key: 'admin', name: 'Priya Nair', email: 'admin@reportflow.dev', role: Role.ADMIN, jobTitle: 'Head of Engineering' },
  { key: 'manager', name: 'Daniel Okafor', email: 'manager@reportflow.dev', role: Role.MANAGER, jobTitle: 'Engineering Manager' },
  { key: 'ava', name: 'Ava Silva', email: 'ava@reportflow.dev', role: Role.TEAM_MEMBER, jobTitle: 'Frontend Engineer' },
  { key: 'noah', name: 'Noah Perera', email: 'noah@reportflow.dev', role: Role.TEAM_MEMBER, jobTitle: 'Backend Engineer' },
  { key: 'maya', name: 'Maya Fernando', email: 'maya@reportflow.dev', role: Role.TEAM_MEMBER, jobTitle: 'QA Engineer' },
  { key: 'liam', name: 'Liam Jayasuriya', email: 'liam@reportflow.dev', role: Role.TEAM_MEMBER, jobTitle: 'Full-stack Engineer' },
  { key: 'zoe', name: 'Zoe Wickramasinghe', email: 'zoe@reportflow.dev', role: Role.TEAM_MEMBER, jobTitle: 'Product Designer' },
];

const PROJECTS: Array<{ key: ProjectKey; name: string; description: string }> = [
  { key: 'clientA', name: 'Client A - Mobile App', description: 'Customer-facing mobile application for Client A (React Native).' },
  { key: 'tooling', name: 'Internal Tooling', description: 'Developer tooling, CI pipelines and automation for the whole team.' },
  { key: 'rnd', name: 'R&D - AI Features', description: 'Research spikes and prototypes for AI-assisted product features.' },
  { key: 'marketing', name: 'Marketing Website', description: 'Public marketing site, landing pages, SEO and experiments.' },
  { key: 'platform', name: 'Platform Migration', description: 'Migration of core services to the new cloud platform.' },
];

/** Which projects each member belongs to; the first one is their "main" project. */
const ASSIGNMENTS: Record<Exclude<UserKey, 'admin' | 'manager'>, ProjectKey[]> = {
  ava: ['clientA', 'marketing'],
  noah: ['platform', 'tooling'],
  maya: ['clientA', 'platform'],
  liam: ['tooling', 'rnd'],
  zoe: ['marketing', 'clientA'],
};

type TaskTemplate = { name: string; output: string };
const TASK_POOLS: Record<ProjectKey, TaskTemplate[]> = {
  clientA: [
    { name: 'Implement onboarding flow screens', output: 'Onboarding PR #412 merged' },
    { name: 'Fix crash on payment confirmation', output: 'Hotfix 2.3.1 released to stores' },
    { name: 'Push notification settings page', output: 'Settings screen handed to QA' },
    { name: 'Offline mode caching layer', output: 'Design doc + working prototype' },
    { name: 'Regression test pass for release 2.4', output: 'Test report shared in Confluence' },
    { name: 'Accessibility audit of checkout', output: 'Audit findings document' },
    { name: 'Order tracking screen design', output: 'Figma mockups v2 approved' },
  ],
  tooling: [
    { name: 'Speed up CI pipeline caching', output: 'Build time down from 14 to 8 minutes' },
    { name: 'Migrate lint config to shared package', output: '@team/lint-config 1.0 published' },
    { name: 'Add PR template and CODEOWNERS', output: 'Merged to main' },
    { name: 'Write release automation script', output: 'release.sh with documentation' },
    { name: 'Dashboard for flaky tests', output: 'Grafana board (draft)' },
    { name: 'Upgrade Node runtime on build agents', output: 'All agents on Node 22' },
  ],
  rnd: [
    { name: 'Prototype AI ticket summariser', output: 'Demo notebook + recording' },
    { name: 'Evaluate embedding models for search', output: 'Comparison spreadsheet' },
    { name: 'RAG pipeline spike', output: 'Spike report v1' },
    { name: 'Prompt library for support answers', output: '12 prompts documented' },
    { name: 'Cost estimate for LLM features', output: 'Cost model sheet' },
  ],
  marketing: [
    { name: 'Redesign pricing page hero', output: 'Final Figma + dev handoff' },
    { name: 'Implement blog listing page', output: 'Deployed to staging' },
    { name: 'Lighthouse performance fixes', output: 'Score improved from 71 to 92' },
    { name: 'A/B test for signup CTA', output: 'Experiment live in Optimizely' },
    { name: 'Newsletter signup component', output: 'Component merged' },
    { name: 'Case study page template', output: 'Template in CMS' },
  ],
  platform: [
    { name: 'Migrate auth service to Kubernetes', output: 'Auth service running on the new cluster' },
    { name: 'Database replication setup', output: 'Replica lag under 1 second' },
    { name: 'Rollback runbook', output: 'Runbook published in the wiki' },
    { name: 'Load test order service', output: 'Load test report' },
    { name: 'Terraform modules for networking', output: 'Modules merged and applied' },
    { name: 'Secrets migration to Vault', output: 'All services reading from Vault' },
  ],
};

const BLOCKERS = [
  'Waiting on the API contract from the backend team',
  'Staging environment was down for two days',
  'Design assets for the new screens arrived late',
  'Flaky end-to-end tests are blocking the release pipeline',
  'Access to production logs is still pending approval',
  'Client feedback on the prototype is overdue',
  'Third-party payment sandbox keeps hitting rate limits',
  'Requirements for the export feature are still unclear',
  'Code review turnaround is slow because two reviewers are on leave',
];

const ACHIEVEMENTS = [
  'Shipped the feature two days ahead of schedule',
  'Cut page load time by 40%',
  'Zero regressions found in the release candidate',
  'Onboarded the new contractor and paired on their first PR',
  'Presented the prototype to stakeholders with positive feedback',
  'Closed six long-standing bugs from the backlog',
  'Raised test coverage from 62% to 78%',
  'Documented the deployment process end to end',
  'Resolved the production incident within 30 minutes',
];

const NOTES = [
  'Out of office on Friday afternoon.',
  'Paired with Maya on the regression suite this week.',
  'Most of the meeting time was the quarterly planning workshop.',
  'Will need a design review slot early next week.',
  'Spent extra time on onboarding docs for the new joiner.',
];

const CORRECTION_COMMENTS = {
  missingOutput: (task: string) =>
    `Please add the deliverable for "${task}" and correct its completion figures - it is marked completed but shows 60% actual progress.`,
  planTooShort: 'The plan for next week is too thin to estimate capacity. Please list the concrete tasks you intend to pick up.',
  hoursMissing: 'The hours breakdown is missing. Please fill in the time spent per category so the workload view stays accurate.',
};

const APPROVAL_COMMENTS = [
  undefined,
  undefined,
  'Looks good, thanks.',
  'Great progress this week - well documented.',
  'Approved. Please keep flagging the payment sandbox issue until it is resolved.',
];

// ---------------------------------------------------------------------------
// Content generation
// ---------------------------------------------------------------------------

interface TaskInput {
  sortOrder: number;
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  plannedPercent: number;
  actualPercent: number;
  plannedHours: number;
  actualHours: number;
  output: string | null;
}
interface ListItemInput {
  sortOrder: number;
  description: string;
  isKey: boolean;
}
interface Content {
  tasks: TaskInput[];
  blockers: ListItemInput[];
  achievements: ListItemInput[];
  hours: Array<{ category: WorkCategory; hours: number }>;
  nextWeekPlan: string;
  notes: string | null;
  links: string | null;
}

function makeTasks(pool: TaskTemplate[], count: number): TaskInput[] {
  const start = int(0, pool.length - 1);
  return Array.from({ length: count }, (_, i) => {
    const template = pool[(start + i) % pool.length];
    const roll = rand();
    const status = roll < 0.65 ? TaskStatus.COMPLETED : roll < 0.9 ? TaskStatus.IN_PROGRESS : TaskStatus.BLOCKED;
    const plannedHours = int(4, 14);
    const actualHours = Math.max(1, Math.round(plannedHours * between(0.7, 1.4)));
    return {
      sortOrder: i,
      name: template.name,
      priority: pick([TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.CRITICAL]),
      status,
      plannedPercent: status === TaskStatus.COMPLETED ? 100 : int(60, 100),
      actualPercent: status === TaskStatus.COMPLETED ? 100 : status === TaskStatus.IN_PROGRESS ? int(30, 85) : int(10, 45),
      plannedHours,
      actualHours,
      output:
        status === TaskStatus.COMPLETED
          ? template.output
          : status === TaskStatus.IN_PROGRESS
            ? `Work in progress - ${template.output.toLowerCase()} expected next week`
            : null,
    };
  });
}

function makeHours(userKey: UserKey): Content['hours'] {
  const entries: Array<[WorkCategory, number]> =
    userKey === 'zoe'
      ? [
          [WorkCategory.DESIGN, int(18, 26)],
          [WorkCategory.MEETINGS, int(3, 7)],
          [WorkCategory.DOCUMENTATION, int(1, 4)],
          [WorkCategory.DEVELOPMENT, int(0, 4)],
        ]
      : userKey === 'maya'
        ? [
            [WorkCategory.TESTING, int(16, 24)],
            [WorkCategory.DEVELOPMENT, int(4, 8)],
            [WorkCategory.MEETINGS, int(3, 6)],
            [WorkCategory.DOCUMENTATION, int(1, 4)],
          ]
        : [
            [WorkCategory.DEVELOPMENT, int(16, 26)],
            [WorkCategory.TESTING, int(3, 8)],
            [WorkCategory.MEETINGS, int(3, 6)],
            [WorkCategory.DOCUMENTATION, int(0, 3)],
            [WorkCategory.SUPPORT, rand() < 0.3 ? int(1, 4) : 0],
          ];
  return entries.filter(([, hours]) => hours > 0).map(([category, hours]) => ({ category, hours }));
}

function makeContent(userKey: UserKey, projectKey: ProjectKey, projectName: string): Content {
  const pool = TASK_POOLS[projectKey];
  const tasks = makeTasks(pool, int(3, 4));
  const inProgress = tasks.find((t) => t.status !== TaskStatus.COMPLETED);
  const nextTemplate = pool[(pool.indexOf(pool.find((t) => t.name === tasks[tasks.length - 1].name)!) + 1) % pool.length];

  const blockerCount = rand() < 0.75 ? int(1, 2) : 0;
  const blockers = pickMany(BLOCKERS, blockerCount).map((description, i) => ({ sortOrder: i, description, isKey: i === 0 }));
  const achievements = pickMany(ACHIEVEMENTS, int(1, 2)).map((description, i) => ({ sortOrder: i, description, isKey: i === 0 }));

  const nextWeekPlan = [
    inProgress ? `Finish "${inProgress.name}" (${projectName}).` : `Wrap up loose ends on ${projectName}.`,
    `Start "${nextTemplate.name}".`,
    pick(['Support release testing and the weekly sync.', 'Review open pull requests from the team.', 'Prepare the demo for the stakeholder meeting.']),
  ].join(' ');

  return {
    tasks,
    blockers,
    achievements,
    hours: makeHours(userKey),
    nextWeekPlan,
    notes: rand() < 0.5 ? pick(NOTES) : null,
    links: rand() < 0.6 ? `https://github.com/reportflow/${projectKey.toLowerCase()}/pull/${int(400, 520)}` : null,
  };
}

/** Produce the "first attempt" that a manager sends back, plus the matching comment. */
function flawedVersion(base: Content): { content: Content; comment: string } {
  const flaw = pick(['missingOutput', 'planTooShort', 'hoursMissing'] as const);
  const content: Content = {
    ...base,
    tasks: base.tasks.map((t) => ({ ...t })),
    blockers: base.blockers.map((b) => ({ ...b })),
    achievements: base.achievements.map((a) => ({ ...a })),
    hours: base.hours.map((h) => ({ ...h })),
  };
  if (flaw === 'missingOutput') {
    content.tasks[0] = { ...content.tasks[0], status: TaskStatus.COMPLETED, actualPercent: 60, output: null };
    return { content, comment: CORRECTION_COMMENTS.missingOutput(content.tasks[0].name) };
  }
  if (flaw === 'planTooShort') {
    content.nextWeekPlan = 'Continue current work.';
    return { content, comment: CORRECTION_COMMENTS.planTooShort };
  }
  content.hours = [];
  return { content, comment: CORRECTION_COMMENTS.hoursMissing };
}

// ---------------------------------------------------------------------------
// Report timeline planning
// ---------------------------------------------------------------------------

type Outcome =
  | 'NONE'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'NEEDS_CORRECTION'
  | 'CORRECTED_SUBMITTED'
  | 'CORRECTED_APPROVED';

/** Deterministic status mix per member (index) and weeks-ago so every state is represented. */
function planFor(memberIndex: number, weeksAgo: number): { outcome: Outcome; late: boolean } {
  const memberKeys: UserKey[] = ['ava', 'noah', 'maya', 'liam', 'zoe'];
  const key = memberKeys[memberIndex];

  if (weeksAgo === 0) {
    // Current week: a couple of drafts, one early submission, two not started.
    const current: Record<string, Outcome> = { ava: 'DRAFT', noah: 'SUBMITTED', maya: 'DRAFT', liam: 'NONE', zoe: 'NONE' };
    return { outcome: current[key], late: false };
  }
  if (weeksAgo === 1) {
    const lastWeek: Record<string, Outcome> = {
      ava: 'SUBMITTED',
      noah: 'APPROVED',
      maya: 'CORRECTED_SUBMITTED',
      liam: 'NEEDS_CORRECTION',
      zoe: 'SUBMITTED',
    };
    return { outcome: lastWeek[key], late: key === 'zoe' };
  }
  if (weeksAgo === 2) {
    const twoWeeksAgo: Record<string, Outcome> = {
      ava: 'APPROVED',
      noah: 'NEEDS_CORRECTION',
      maya: 'CORRECTED_APPROVED',
      liam: 'APPROVED',
      zoe: 'APPROVED',
    };
    return { outcome: twoWeeksAgo[key], late: key === 'zoe' };
  }
  // Older weeks: approved, with occasional correction cycles, late submissions and one gap.
  if (key === 'liam' && weeksAgo === 5) return { outcome: 'NONE', late: false };
  if ((memberIndex + weeksAgo) % 5 === 0) return { outcome: 'CORRECTED_APPROVED', late: false };
  return { outcome: 'APPROVED', late: (memberIndex + weeksAgo) % 7 === 3 };
}

type TimelineEvent =
  | { type: 'SUBMIT'; at: Date }
  | { type: 'REQUEST_CHANGES'; at: Date; comment: string }
  | { type: 'APPROVE'; at: Date; comment?: string };

function buildTimeline(outcome: Outcome, late: boolean, weekStart: Date, base: Content) {
  const monday = addWeeks(weekStart, 1); // the Monday after the reporting week
  const firstSubmit = clampPast(
    weekStart.getTime() === currentWeekStart().getTime()
      ? atHour(addDays(weekStart, 3), 9, 30) // current week: submitted mid-week
      : late
        ? atHour(addDays(monday, 2), 10, 15)
        : atHour(monday, int(9, 16), pick([0, 15, 30, 45])),
  );
  const events: TimelineEvent[] = [];
  const versions: Content[] = [];

  if (outcome === 'NONE' || outcome === 'DRAFT') return { events, versions: [base] };

  const needsCorrection = outcome.startsWith('CORRECTED') || outcome === 'NEEDS_CORRECTION';
  if (needsCorrection) {
    const { content, comment } = flawedVersion(base);
    versions.push(content);
    events.push({ type: 'SUBMIT', at: firstSubmit });
    const reviewAt = clampPast(addHours(firstSubmit, int(5, 30)));
    events.push({ type: 'REQUEST_CHANGES', at: reviewAt, comment });
    if (outcome !== 'NEEDS_CORRECTION') {
      versions.push(base);
      const resubmitAt = clampPast(addHours(reviewAt, int(18, 40)));
      events.push({ type: 'SUBMIT', at: resubmitAt });
      if (outcome === 'CORRECTED_APPROVED') {
        events.push({ type: 'APPROVE', at: clampPast(addHours(resubmitAt, int(3, 12))), comment: pick(APPROVAL_COMMENTS) });
      }
    }
    return { events, versions };
  }

  versions.push(base);
  events.push({ type: 'SUBMIT', at: firstSubmit });
  if (outcome === 'APPROVED') {
    events.push({ type: 'APPROVE', at: clampPast(addHours(firstSubmit, int(4, 30))), comment: pick(APPROVAL_COMMENTS) });
  }
  return { events, versions };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function resetDatabase() {
  await prisma.activityLog.deleteMany();
  await prisma.reviewHistory.deleteMany();
  await prisma.reportVersion.deleteMany();
  await prisma.hoursEntry.deleteMany();
  await prisma.blocker.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.reportTask.deleteMany();
  await prisma.report.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}

async function seedReport(opts: {
  userId: string;
  reviewerId: string;
  project: { id: string; name: string };
  weekStart: Date;
  createdAt: Date;
  versions: Content[];
  events: TimelineEvent[];
}) {
  const { userId, reviewerId, project, weekStart, createdAt, versions, events } = opts;
  const weekEnd = endOfWeek(weekStart);
  const live = versions[versions.length - 1];

  const report = await prisma.report.create({
    data: {
      userId,
      projectId: project.id,
      weekStart,
      weekEnd,
      createdAt,
      nextWeekPlan: live.nextWeekPlan,
      notes: live.notes,
      links: live.links,
      tasks: { create: live.tasks },
      blockers: { create: live.blockers },
      achievements: { create: live.achievements },
      hours: { create: live.hours },
    },
  });
  await prisma.activityLog.create({
    data: { type: ActivityType.REPORT_CREATED, actorId: userId, reportId: report.id, createdAt },
  });

  let versionIndex = 0;
  let latestVersionId: string | undefined;
  for (const event of events) {
    if (event.type === 'SUBMIT') {
      const content = versions[versionIndex];
      versionIndex += 1;
      const snapshot = buildSnapshot({ weekStart, weekEnd, project, ...content });
      const version = await prisma.reportVersion.create({
        data: { reportId: report.id, versionNumber: versionIndex, submittedAt: event.at, snapshot: snapshotToJson(snapshot) },
      });
      latestVersionId = version.id;
      await prisma.report.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.SUBMITTED,
          currentVersion: versionIndex,
          submittedAt: event.at,
          firstSubmittedAt: versionIndex === 1 ? event.at : undefined,
        },
      });
      await prisma.activityLog.create({
        data: {
          type: versionIndex === 1 ? ActivityType.REPORT_SUBMITTED : ActivityType.REPORT_RESUBMITTED,
          actorId: userId,
          reportId: report.id,
          details: { versionNumber: versionIndex },
          createdAt: event.at,
        },
      });
      continue;
    }

    const approve = event.type === 'APPROVE';
    await prisma.reviewHistory.create({
      data: {
        reportId: report.id,
        versionId: latestVersionId,
        reviewerId,
        action: approve ? ReviewAction.APPROVED : ReviewAction.CHANGES_REQUESTED,
        comment: event.comment ?? null,
        createdAt: event.at,
      },
    });
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: approve ? ReportStatus.APPROVED : ReportStatus.NEEDS_CORRECTION,
        latestReviewComment: event.comment ?? null,
        reviewedAt: event.at,
      },
    });
    await prisma.activityLog.create({
      data: {
        type: approve ? ActivityType.REPORT_APPROVED : ActivityType.REPORT_CHANGES_REQUESTED,
        actorId: reviewerId,
        reportId: report.id,
        details: { versionNumber: versionIndex, comment: event.comment ?? null },
        createdAt: event.at,
      },
    });
  }
}

async function main() {
  console.log('Resetting database...');
  await resetDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const accountsCreatedAt = addDays(now, -120);

  console.log('Creating users and projects...');
  const users = {} as Record<UserKey, { id: string; name: string }>;
  for (const u of USERS) {
    const created = await prisma.user.create({
      data: { name: u.name, email: u.email, role: u.role, jobTitle: u.jobTitle, passwordHash, createdAt: accountsCreatedAt },
    });
    users[u.key] = { id: created.id, name: created.name };
  }

  const projects = {} as Record<ProjectKey, { id: string; name: string }>;
  for (const p of PROJECTS) {
    const created = await prisma.project.create({
      data: { name: p.name, description: p.description, createdAt: accountsCreatedAt },
    });
    projects[p.key] = { id: created.id, name: created.name };
  }
  for (const [userKey, projectKeys] of Object.entries(ASSIGNMENTS) as Array<[UserKey, ProjectKey[]]>) {
    await prisma.projectMember.createMany({
      data: projectKeys.map((projectKey) => ({ userId: users[userKey].id, projectId: projects[projectKey].id })),
    });
  }
  await prisma.activityLog.create({
    data: {
      type: ActivityType.PROJECT_CREATED,
      actorId: users.admin.id,
      details: { projectName: projects.platform.name },
      createdAt: addDays(now, -100),
    },
  });

  console.log(`Creating ${WEEKS_OF_HISTORY} weeks of reports...`);
  const memberKeys: Array<Exclude<UserKey, 'admin' | 'manager'>> = ['ava', 'noah', 'maya', 'liam', 'zoe'];
  const thisWeek = currentWeekStart();
  let reportCount = 0;

  for (let weeksAgo = WEEKS_OF_HISTORY - 1; weeksAgo >= 0; weeksAgo--) {
    const weekStart = addWeeks(thisWeek, -weeksAgo);
    for (const [memberIndex, memberKey] of memberKeys.entries()) {
      const { outcome, late } = planFor(memberIndex, weeksAgo);
      if (outcome === 'NONE') continue;

      const assigned = ASSIGNMENTS[memberKey];
      // Mostly the member's main project, sometimes the secondary one.
      const projectKey = rand() < 0.7 ? assigned[0] : assigned[1];
      const project = projects[projectKey];
      const base = makeContent(memberKey, projectKey, project.name);
      const { events, versions } = buildTimeline(outcome, late, weekStart, base);

      await seedReport({
        userId: users[memberKey].id,
        reviewerId: users.manager.id,
        project,
        weekStart,
        createdAt: clampPast(weeksAgo === 0 ? atHour(addDays(weekStart, 1), 10) : atHour(addDays(weekStart, 4), 16)),
        versions,
        events,
      });
      reportCount += 1;
    }
  }

  console.log(`\nSeeded ${USERS.length} users, ${PROJECTS.length} projects and ${reportCount} reports`);
  console.log(`Weeks covered: ${formatWeekLabel(addWeeks(thisWeek, -(WEEKS_OF_HISTORY - 1)))} to ${formatWeekLabel(thisWeek)}`);
  console.log(`\nDemo accounts (password for all: ${DEMO_PASSWORD})`);
  for (const u of USERS) console.log(`  ${u.role.padEnd(11)} ${u.email.padEnd(26)} ${u.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
