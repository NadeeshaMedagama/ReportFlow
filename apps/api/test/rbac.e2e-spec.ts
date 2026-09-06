/**
 * End-to-end test of role-based access control and the review workflow.
 * Boots the real application against DATABASE_URL, creates its own users
 * (unique e-mails) and removes everything it created afterwards.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ReportStatus, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';

const PASSWORD = 'Password123!';
const suffix = Date.now().toString(36);
const emails = {
  memberA: `e2e-member-a-${suffix}@test.local`,
  memberB: `e2e-member-b-${suffix}@test.local`,
  manager: `e2e-manager-${suffix}@test.local`,
  admin: `e2e-admin-${suffix}@test.local`,
};
type Actor = keyof typeof emails;

const reportPayload = (weekStart: string) => ({
  weekStart,
  projectId: '',
  tasks: [
    {
      name: 'Implement login form',
      priority: 'HIGH',
      status: 'COMPLETED',
      plannedPercent: 100,
      actualPercent: 100,
      plannedHours: 6,
      actualHours: 7,
      output: 'PR #1 merged',
    },
  ],
  nextWeekPlan: 'Start on the dashboard',
  blockers: [{ description: 'Waiting on designs', isKey: true }],
  achievements: [{ description: 'Shipped login', isKey: true }],
  hours: [{ category: 'DEVELOPMENT', hours: 20 }],
});

describe('RBAC and review workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Partial<Record<Actor, string>> = {};
  let projectId = '';
  let reportId = '';
  let memberAId = '';
  let memberBId = '';

  const api = () => request(app.getHttpServer());
  const as = (actor: Actor) => ({ Authorization: `Bearer ${tokens[actor]}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);

    // Manager and admin accounts can only be created by an admin, so seed them directly.
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    await prisma.user.createMany({
      data: [
        { name: 'E2E Manager', email: emails.manager, passwordHash, role: Role.MANAGER },
        { name: 'E2E Admin', email: emails.admin, passwordHash, role: Role.ADMIN },
      ],
    });
    for (const actor of ['manager', 'admin'] as Actor[]) {
      const res = await api().post('/auth/login').send({ email: emails[actor], password: PASSWORD }).expect(200);
      tokens[actor] = res.body.accessToken;
    }
  });

  afterAll(async () => {
    const createdEmails = Object.values(emails);
    await prisma.report.deleteMany({ where: { user: { email: { in: createdEmails } } } });
    await prisma.activityLog.deleteMany({ where: { actor: { email: { in: createdEmails } } } });
    if (projectId) await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await app.close();
  });

  it('registers team members and returns a session without the password hash', async () => {
    for (const actor of ['memberA', 'memberB'] as Actor[]) {
      const res = await api()
        .post('/auth/register')
        .send({ name: `E2E ${actor}`, email: emails[actor], password: PASSWORD })
        .expect(201);
      expect(res.body.user.role).toBe(Role.TEAM_MEMBER);
      expect(res.body.user).not.toHaveProperty('passwordHash');
      tokens[actor] = res.body.accessToken;
    }
    memberAId = (await api().get('/auth/me').set(as('memberA')).expect(200)).body.id;
    memberBId = (await api().get('/auth/me').set(as('memberB')).expect(200)).body.id;
  });

  it('rejects requests without a valid token', async () => {
    await api().get('/reports').expect(401);
    await api().get('/auth/me').set({ Authorization: 'Bearer nope' }).expect(401);
  });

  it('blocks team members from manager-only endpoints', async () => {
    await api().get('/dashboard/summary').set(as('memberA')).expect(403);
    await api().get('/dashboard/activity').set(as('memberA')).expect(403);
    await api().get('/users').set(as('memberA')).expect(403);
    await api().get('/assistant/status').set(as('memberA')).expect(403);
    await api().post('/projects').set(as('memberA')).send({ name: 'Nope' }).expect(403);
  });

  it('blocks managers from admin-only endpoints', async () => {
    await api()
      .post('/users')
      .set(as('manager'))
      .send({ name: 'X', email: `x-${suffix}@test.local`, password: PASSWORD, role: 'MANAGER' })
      .expect(403);
    await api().patch(`/users/${memberBId}`).set(as('manager')).send({ role: 'MANAGER' }).expect(403);
  });

  it('lets a manager create a project and validates the payload', async () => {
    await api().post('/projects').set(as('manager')).send({ name: 'X' }).expect(400);
    const res = await api()
      .post('/projects')
      .set(as('manager'))
      .send({ name: `E2E Project ${suffix}`, description: 'Temporary', memberIds: [memberAId] })
      .expect(201);
    projectId = res.body.id;
    expect(res.body.members.map((m: { id: string }) => m.id)).toEqual([memberAId]);
  });

  it('lets a team member create a draft, but not a manager', async () => {
    const payload = { ...reportPayload('2026-08-24'), projectId };
    await api().post('/reports').set(as('manager')).send(payload).expect(403);
    await api().post('/reports').set(as('memberA')).send({ ...payload, weekStart: '2026-08-25' }).expect(400); // not a Monday

    const res = await api().post('/reports').set(as('memberA')).send(payload).expect(201);
    reportId = res.body.id;
    expect(res.body.status).toBe(ReportStatus.DRAFT);
    expect(res.body.permissions).toMatchObject({ canEdit: true, canSubmit: true, canDelete: true });

    await api().post('/reports').set(as('memberA')).send(payload).expect(409); // one report per week
  });

  it('hides one member\'s report from another member', async () => {
    await api().get(`/reports/${reportId}`).set(as('memberB')).expect(403);
    await api().patch(`/reports/${reportId}`).set(as('memberB')).send({ ...reportPayload('2026-08-24'), projectId }).expect(403);
    await api().post(`/reports/${reportId}/submit`).set(as('memberB')).expect(403);
    await api().get(`/reports/${reportId}/versions`).set(as('memberB')).expect(403);

    const list = await api().get('/reports').set(as('memberB')).expect(200);
    expect(list.body.items.some((r: { id: string }) => r.id === reportId)).toBe(false);
  });

  it('shows drafts to managers only as a status, never their content', async () => {
    await api().get(`/reports/${reportId}`).set(as('manager')).expect(403);
    const list = await api().get(`/reports?memberId=${memberAId}`).set(as('manager')).expect(200);
    const row = list.body.items.find((r: { id: string }) => r.id === reportId);
    expect(row.status).toBe(ReportStatus.DRAFT);
  });

  it('never lets a manager edit report content', async () => {
    await api().patch(`/reports/${reportId}`).set(as('manager')).send({ ...reportPayload('2026-08-24'), projectId }).expect(403);
    await api().delete(`/reports/${reportId}`).set(as('manager')).expect(403);
  });

  it('runs the full cycle: submit -> request changes -> edit -> resubmit -> approve', async () => {
    // Submit v1
    const submitted = await api().post(`/reports/${reportId}/submit`).set(as('memberA')).expect(200);
    expect(submitted.body.status).toBe(ReportStatus.SUBMITTED);
    expect(submitted.body.currentVersion).toBe(1);

    // Owner can no longer edit while under review
    await api().patch(`/reports/${reportId}`).set(as('memberA')).send({ ...reportPayload('2026-08-24'), projectId }).expect(400);

    // Team members cannot review
    await api().post(`/reports/${reportId}/review`).set(as('memberA')).send({ decision: 'APPROVE' }).expect(403);

    // Manager must leave a comment when requesting changes
    await api().post(`/reports/${reportId}/review`).set(as('manager')).send({ decision: 'REQUEST_CHANGES' }).expect(400);
    const sentBack = await api()
      .post(`/reports/${reportId}/review`)
      .set(as('manager'))
      .send({ decision: 'REQUEST_CHANGES', comment: 'Please add the test report as output.' })
      .expect(200);
    expect(sentBack.body.status).toBe(ReportStatus.NEEDS_CORRECTION);

    // The team member sees the comment and can edit again
    const mine = await api().get(`/reports/${reportId}`).set(as('memberA')).expect(200);
    expect(mine.body.latestReviewComment).toBe('Please add the test report as output.');
    expect(mine.body.permissions.canEdit).toBe(true);

    const fixed = { ...reportPayload('2026-08-24'), projectId };
    fixed.tasks[0].output = 'PR #1 merged + test report';
    const edited = await api().patch(`/reports/${reportId}`).set(as('memberA')).send(fixed).expect(200);
    expect(edited.body.tasks[0].output).toBe('PR #1 merged + test report');
    // The week is locked once a report has been submitted
    await api().patch(`/reports/${reportId}`).set(as('memberA')).send({ ...fixed, weekStart: '2026-08-31' }).expect(400);

    // Resubmit -> version 2
    const resubmitted = await api().post(`/reports/${reportId}/submit`).set(as('memberA')).expect(200);
    expect(resubmitted.body.status).toBe(ReportStatus.SUBMITTED);
    expect(resubmitted.body.currentVersion).toBe(2);

    // Version history keeps both versions; the comment is linked to version 1
    const versions = await api().get(`/reports/${reportId}/versions`).set(as('manager')).expect(200);
    expect(versions.body.map((v: { versionNumber: number }) => v.versionNumber)).toEqual([2, 1]);
    expect(versions.body[1].reviews[0].comment).toBe('Please add the test report as output.');
    const v1 = await api().get(`/reports/${reportId}/versions/${versions.body[1].id}`).set(as('manager')).expect(200);
    expect(v1.body.snapshot.tasks[0].output).toBe('PR #1 merged');

    // Approve version 2
    const approved = await api()
      .post(`/reports/${reportId}/review`)
      .set(as('manager'))
      .send({ decision: 'APPROVE', comment: 'Thanks!' })
      .expect(200);
    expect(approved.body.status).toBe(ReportStatus.APPROVED);
    await api().patch(`/reports/${reportId}`).set(as('memberA')).send(fixed).expect(400);

    const reviews = await api().get(`/reports/${reportId}/reviews`).set(as('memberA')).expect(200);
    expect(reviews.body).toHaveLength(2);
    expect(reviews.body[0].version.versionNumber).toBe(2);
    expect(reviews.body[1].version.versionNumber).toBe(1);
  });

  it('exposes the dashboard and team data to managers', async () => {
    const summary = await api().get('/dashboard/summary?weekStart=2026-08-24').set(as('manager')).expect(200);
    expect(summary.body.week.weekStart).toBe('2026-08-24');
    await api().get('/dashboard/summary?weekStart=2026-08-25').set(as('manager')).expect(400);
    const users = await api().get('/users').set(as('manager')).expect(200);
    expect(users.body.some((u: { id: string }) => u.id === memberAId)).toBe(true);
    expect(users.body[0]).not.toHaveProperty('passwordHash');
  });

  it('lets an admin change roles, after which the new manager gains access', async () => {
    await api().get('/dashboard/summary').set(as('memberB')).expect(403);
    const res = await api().patch(`/users/${memberBId}`).set(as('admin')).send({ role: 'MANAGER' }).expect(200);
    expect(res.body.role).toBe(Role.MANAGER);
    await api().get('/dashboard/summary').set(as('memberB')).expect(200);
  });
});
