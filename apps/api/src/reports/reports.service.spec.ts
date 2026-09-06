import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ActivityType, ReportStatus, ReviewAction, Role, TaskPriority, TaskStatus } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReviewDecision } from './dto/review.dto';
import { ReportsService } from './reports.service';

const member: AuthUser = { id: 'member-1', name: 'Ava', email: 'ava@test.local', role: Role.TEAM_MEMBER, jobTitle: null, active: true, createdAt: new Date() };
const otherMember: AuthUser = { ...member, id: 'member-2', name: 'Noah', email: 'noah@test.local' };
const manager: AuthUser = { ...member, id: 'manager-1', name: 'Daniel', email: 'daniel@test.local', role: Role.MANAGER };

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    userId: member.id,
    projectId: 'p1',
    status: ReportStatus.SUBMITTED,
    weekStart: new Date('2026-08-24T00:00:00.000Z'),
    weekEnd: new Date('2026-08-30T00:00:00.000Z'),
    currentVersion: 1,
    firstSubmittedAt: new Date('2026-08-31T09:00:00.000Z'),
    nextWeekPlan: 'Finish the feature',
    notes: null,
    links: null,
    project: { id: 'p1', name: 'Client A', active: true },
    tasks: [
      {
        id: 't1', reportId: 'r1', sortOrder: 0, name: 'Build screen', priority: TaskPriority.HIGH, status: TaskStatus.COMPLETED,
        plannedPercent: 100, actualPercent: 100, plannedHours: 8, actualHours: 9, output: 'PR merged',
      },
    ],
    blockers: [],
    achievements: [],
    hours: [],
    versions: [],
    reviews: [],
    ...overrides,
  };
}

function createPrismaMock() {
  const tx = {
    report: { update: jest.fn() },
    reportVersion: { create: jest.fn() },
    reviewHistory: { create: jest.fn() },
    reportTask: { deleteMany: jest.fn() },
    blocker: { deleteMany: jest.fn() },
    achievement: { deleteMany: jest.fn() },
    hoursEntry: { deleteMany: jest.fn() },
  };
  const prisma = {
    report: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), delete: jest.fn() },
    reportVersion: { findFirst: jest.fn(), findMany: jest.fn() },
    reviewHistory: { findMany: jest.fn() },
    activityLog: { create: jest.fn().mockResolvedValue({}) },
    project: { findUnique: jest.fn().mockResolvedValue({ active: true }) },
    // Interactive transactions run the callback against the tx mock; array
    // transactions resolve the given promises.
    $transaction: jest.fn(async (arg: unknown) => (typeof arg === 'function' ? arg(tx) : Promise.all(arg as Promise<unknown>[]))),
  };
  return { prisma, tx };
}

describe('ReportsService authorization and workflow', () => {
  let prisma: ReturnType<typeof createPrismaMock>['prisma'];
  let tx: ReturnType<typeof createPrismaMock>['tx'];
  let service: ReportsService;

  beforeEach(() => {
    ({ prisma, tx } = createPrismaMock());
    service = new ReportsService(prisma as unknown as PrismaService);
  });

  describe('viewing reports', () => {
    it('does not let a team member open another member\'s report', async () => {
      prisma.report.findUnique.mockResolvedValue(report());
      await expect(service.findOne('r1', otherMember)).rejects.toThrow(ForbiddenException);
    });

    it('lets the owner open their own report with edit permissions computed', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.NEEDS_CORRECTION }));
      const result = await service.findOne('r1', member);
      expect(result.permissions).toMatchObject({ canEdit: true, canSubmit: true, canReview: false, canDelete: false });
    });

    it('lets a manager open a submitted report and marks it reviewable', async () => {
      prisma.report.findUnique.mockResolvedValue(report());
      const result = await service.findOne('r1', manager);
      expect(result.permissions).toMatchObject({ canReview: true, canEdit: false });
    });

    it('keeps drafts private: managers cannot open them', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.DRAFT }));
      await expect(service.findOne('r1', manager)).rejects.toThrow(ForbiddenException);
    });

    it('always scopes a team member\'s list to their own reports, even if memberId is passed', async () => {
      await service.list({ page: 1, limit: 20, memberId: otherMember.id }, member);
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: member.id }) }),
      );
    });

    it('lets managers filter the team list by member', async () => {
      await service.list({ page: 1, limit: 20, memberId: otherMember.id }, manager);
      expect(prisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: otherMember.id }) }),
      );
    });
  });

  describe('editing reports', () => {
    const dto = { weekStart: '2026-08-24', projectId: 'p1', tasks: [] };

    it('never lets a manager rewrite report content', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.NEEDS_CORRECTION }));
      await expect(service.update('r1', dto, manager)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not let another team member edit the report', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.DRAFT }));
      await expect(service.update('r1', dto, otherMember)).rejects.toThrow(ForbiddenException);
    });

    it('locks approved and submitted reports', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.APPROVED }));
      await expect(service.update('r1', dto, member)).rejects.toThrow(BadRequestException);
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.SUBMITTED }));
      await expect(service.update('r1', dto, member)).rejects.toThrow(BadRequestException);
    });

    it('rejects more than one key blocker', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.DRAFT }));
      const twoKeys = { ...dto, blockers: [{ description: 'a', isKey: true }, { description: 'b', isKey: true }] };
      await expect(service.update('r1', twoKeys, member)).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitting reports', () => {
    it('refuses to submit an incomplete report', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.DRAFT, tasks: [], nextWeekPlan: '' }));
      await expect(service.submit('r1', member)).rejects.toThrow(/incomplete/);
    });

    it('creates the next immutable version and moves the report to SUBMITTED', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.NEEDS_CORRECTION, currentVersion: 1 }));
      tx.report.update.mockResolvedValue(report({ status: ReportStatus.SUBMITTED, currentVersion: 2 }));

      const result = await service.submit('r1', member);

      expect(tx.reportVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reportId: 'r1', versionNumber: 2 }) }),
      );
      const snapshot = tx.reportVersion.create.mock.calls[0][0].data.snapshot;
      expect(snapshot.tasks[0].name).toBe('Build screen');
      expect(result.status).toBe(ReportStatus.SUBMITTED);
      expect(prisma.activityLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: ActivityType.REPORT_RESUBMITTED }) }),
      );
    });

    it('does not let a manager submit on behalf of a member', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.DRAFT }));
      await expect(service.submit('r1', manager)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('reviewing reports', () => {
    it('does not let a team member review', async () => {
      prisma.report.findUnique.mockResolvedValue(report());
      await expect(service.review('r1', { decision: ReviewDecision.APPROVE }, member)).rejects.toThrow(ForbiddenException);
    });

    it('requires a comment when requesting changes', async () => {
      prisma.report.findUnique.mockResolvedValue(report());
      await expect(
        service.review('r1', { decision: ReviewDecision.REQUEST_CHANGES, comment: '  ' }, manager),
      ).rejects.toThrow(BadRequestException);
    });

    it('only reviews reports that are currently submitted', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.APPROVED }));
      await expect(service.review('r1', { decision: ReviewDecision.APPROVE }, manager)).rejects.toThrow(BadRequestException);
    });

    it('records the decision against the version under review', async () => {
      prisma.report.findUnique.mockResolvedValue(report({ status: ReportStatus.SUBMITTED, currentVersion: 2 }));
      prisma.reportVersion.findFirst.mockResolvedValue({ id: 'v2', versionNumber: 2 });
      tx.report.update.mockResolvedValue(report({ status: ReportStatus.NEEDS_CORRECTION, latestReviewComment: 'Add the deliverable' }));

      const result = await service.review('r1', { decision: ReviewDecision.REQUEST_CHANGES, comment: 'Add the deliverable' }, manager);

      expect(tx.reviewHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reportId: 'r1',
          versionId: 'v2',
          reviewerId: manager.id,
          action: ReviewAction.CHANGES_REQUESTED,
          comment: 'Add the deliverable',
        }),
      });
      expect(tx.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ReportStatus.NEEDS_CORRECTION }) }),
      );
      expect(result.status).toBe(ReportStatus.NEEDS_CORRECTION);
    });
  });
});
