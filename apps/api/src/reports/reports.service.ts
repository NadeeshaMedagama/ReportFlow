import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, Prisma, ReportStatus, ReviewAction, Role } from '@prisma/client';
import { AuthUser, isManager } from '../auth/auth-user';
import { PrismaService } from '../common/prisma/prisma.service';
import { endOfWeek, isMonday, parseDateOnly } from '../common/week';
import { PUBLIC_USER_SELECT } from '../users/user.select';
import { ListReportsQueryDto } from './dto/list-reports.query';
import { ReportListItemDto, UpsertReportDto } from './dto/report.dto';
import { ReviewDecision, ReviewReportDto } from './dto/review.dto';
import { buildSnapshot, snapshotToJson } from './report-snapshot';

/** Fields returned in list views. */
export const REPORT_SUMMARY_INCLUDE = {
  user: { select: PUBLIC_USER_SELECT },
  project: { select: { id: true, name: true, active: true } },
  _count: { select: { tasks: true, blockers: true, achievements: true } },
} satisfies Prisma.ReportInclude;

/** Fields returned for a single report (full content + version + review metadata). */
export const REPORT_DETAIL_INCLUDE = {
  user: { select: PUBLIC_USER_SELECT },
  project: { select: { id: true, name: true, active: true } },
  tasks: { orderBy: { sortOrder: 'asc' } },
  blockers: { orderBy: { sortOrder: 'asc' } },
  achievements: { orderBy: { sortOrder: 'asc' } },
  hours: { orderBy: { category: 'asc' } },
  versions: { select: { id: true, versionNumber: true, submittedAt: true }, orderBy: { versionNumber: 'desc' } },
  reviews: {
    include: {
      reviewer: { select: PUBLIC_USER_SELECT },
      version: { select: { id: true, versionNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.ReportInclude;

type ReportDetail = Prisma.ReportGetPayload<{ include: typeof REPORT_DETAIL_INCLUDE }>;
type ReportCore = Pick<Prisma.ReportGetPayload<object>, 'id' | 'userId' | 'status'>;

const EDITABLE_STATUSES: ReportStatus[] = [ReportStatus.DRAFT, ReportStatus.NEEDS_CORRECTION];

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------

  async list(query: ListReportsQueryDto, user: AuthUser) {
    const where = this.buildWhere(query, user);
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: REPORT_SUMMARY_INCLUDE,
        orderBy: [{ weekStart: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      items: items.map((report) => ({ ...report, permissions: this.permissionsFor(report, user) })),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  async findOne(id: string, user: AuthUser) {
    const report = await this.prisma.report.findUnique({ where: { id }, include: REPORT_DETAIL_INCLUDE });
    if (!report) throw new NotFoundException('Report not found');
    this.assertCanView(report, user);
    return this.withPermissions(report, user);
  }

  async listVersions(id: string, user: AuthUser) {
    const report = await this.getCoreOrThrow(id);
    this.assertCanView(report, user);
    return this.prisma.reportVersion.findMany({
      where: { reportId: id },
      select: {
        id: true,
        versionNumber: true,
        submittedAt: true,
        reviews: {
          select: {
            id: true,
            action: true,
            comment: true,
            createdAt: true,
            reviewer: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async getVersion(id: string, versionId: string, user: AuthUser) {
    const report = await this.getCoreOrThrow(id);
    this.assertCanView(report, user);
    const version = await this.prisma.reportVersion.findFirst({
      where: { id: versionId, reportId: id },
      include: {
        reviews: {
          include: { reviewer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!version) throw new NotFoundException('Version not found');
    return version;
  }

  async listReviews(id: string, user: AuthUser) {
    const report = await this.getCoreOrThrow(id);
    this.assertCanView(report, user);
    return this.prisma.reviewHistory.findMany({
      where: { reportId: id },
      include: {
        reviewer: { select: PUBLIC_USER_SELECT },
        version: { select: { id: true, versionNumber: true, submittedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------------
  // Team member actions: create / edit / delete / submit
  // ---------------------------------------------------------------------

  async create(dto: UpsertReportDto, user: AuthUser) {
    if (user.role !== Role.TEAM_MEMBER) {
      throw new ForbiddenException('Only team members can create weekly reports');
    }
    const weekStart = this.parseWeekStart(dto.weekStart);
    this.validateContent(dto);
    await this.assertProjectSelectable(dto.projectId);

    const clash = await this.prisma.report.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } },
      select: { id: true },
    });
    if (clash) throw new ConflictException('You already have a report for this week');

    const report = await this.prisma.report.create({
      data: {
        userId: user.id,
        weekStart,
        weekEnd: endOfWeek(weekStart),
        ...this.contentData(dto),
      },
      include: REPORT_DETAIL_INCLUDE,
    });
    await this.log(ActivityType.REPORT_CREATED, user.id, report.id);
    return this.withPermissions(report, user);
  }

  async update(id: string, dto: UpsertReportDto, user: AuthUser) {
    const report = await this.getCoreOrThrow(id, { weekStart: true, projectId: true });
    this.assertOwner(report, user);
    this.assertEditable(report);
    this.validateContent(dto);

    const weekStart = this.parseWeekStart(dto.weekStart);
    const weekChanged = weekStart.getTime() !== report.weekStart.getTime();
    if (weekChanged && report.status !== ReportStatus.DRAFT) {
      throw new BadRequestException('The week of a report that has already been submitted cannot be changed');
    }
    if (weekChanged) {
      const clash = await this.prisma.report.findUnique({
        where: { userId_weekStart: { userId: user.id, weekStart } },
        select: { id: true },
      });
      if (clash) throw new ConflictException('You already have a report for that week');
    }
    await this.assertProjectSelectable(dto.projectId, report.projectId);

    // The whole content is replaced: delete child rows and recreate them.
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reportTask.deleteMany({ where: { reportId: id } });
      await tx.blocker.deleteMany({ where: { reportId: id } });
      await tx.achievement.deleteMany({ where: { reportId: id } });
      await tx.hoursEntry.deleteMany({ where: { reportId: id } });
      return tx.report.update({
        where: { id },
        data: { weekStart, weekEnd: endOfWeek(weekStart), ...this.contentData(dto) },
        include: REPORT_DETAIL_INCLUDE,
      });
    });
    return this.withPermissions(updated, user);
  }

  async remove(id: string, user: AuthUser) {
    const report = await this.getCoreOrThrow(id);
    this.assertOwner(report, user);
    if (report.status !== ReportStatus.DRAFT) {
      throw new BadRequestException('Only draft reports can be deleted');
    }
    await this.prisma.report.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Submit (or resubmit) for review. Every submission stores an immutable
   * snapshot as a new ReportVersion so past versions remain visible.
   */
  async submit(id: string, user: AuthUser) {
    const report = await this.prisma.report.findUnique({ where: { id }, include: REPORT_DETAIL_INCLUDE });
    if (!report) throw new NotFoundException('Report not found');
    this.assertOwner(report, user);
    this.assertEditable(report);
    this.assertComplete(report);

    const now = new Date();
    const versionNumber = report.currentVersion + 1;
    const snapshot = snapshotToJson(buildSnapshot(report));

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reportVersion.create({ data: { reportId: id, versionNumber, submittedAt: now, snapshot } });
      return tx.report.update({
        where: { id },
        data: {
          status: ReportStatus.SUBMITTED,
          currentVersion: versionNumber,
          submittedAt: now,
          firstSubmittedAt: report.firstSubmittedAt ?? now,
        },
        include: REPORT_DETAIL_INCLUDE,
      });
    });

    await this.log(
      versionNumber === 1 ? ActivityType.REPORT_SUBMITTED : ActivityType.REPORT_RESUBMITTED,
      user.id,
      id,
      { versionNumber },
    );
    return this.withPermissions(updated, user);
  }

  // ---------------------------------------------------------------------
  // Manager action: approve / request changes
  // ---------------------------------------------------------------------

  async review(id: string, dto: ReviewReportDto, reviewer: AuthUser) {
    if (!isManager(reviewer)) throw new ForbiddenException('Only managers can review reports');

    const report = await this.getCoreOrThrow(id, { currentVersion: true });
    if (report.status !== ReportStatus.SUBMITTED) {
      throw new BadRequestException('Only submitted reports can be reviewed');
    }
    const comment = dto.comment?.trim() || null;
    const approve = dto.decision === ReviewDecision.APPROVE;
    if (!approve && !comment) {
      throw new BadRequestException('A comment describing the required changes is mandatory');
    }

    // The decision is recorded against the version currently under review.
    const currentVersion = await this.prisma.reportVersion.findFirst({
      where: { reportId: id },
      orderBy: { versionNumber: 'desc' },
      select: { id: true, versionNumber: true },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.reviewHistory.create({
        data: {
          reportId: id,
          versionId: currentVersion?.id,
          reviewerId: reviewer.id,
          action: approve ? ReviewAction.APPROVED : ReviewAction.CHANGES_REQUESTED,
          comment,
        },
      });
      return tx.report.update({
        where: { id },
        data: {
          status: approve ? ReportStatus.APPROVED : ReportStatus.NEEDS_CORRECTION,
          latestReviewComment: comment,
          reviewedAt: new Date(),
        },
        include: REPORT_DETAIL_INCLUDE,
      });
    });

    await this.log(
      approve ? ActivityType.REPORT_APPROVED : ActivityType.REPORT_CHANGES_REQUESTED,
      reviewer.id,
      id,
      { versionNumber: currentVersion?.versionNumber ?? null, comment },
    );
    return this.withPermissions(updated, reviewer);
  }

  // ---------------------------------------------------------------------
  // Authorization rules (single place, unit tested)
  // ---------------------------------------------------------------------

  /** Owners always see their report; managers see everything except drafts. */
  assertCanView(report: ReportCore, user: AuthUser) {
    if (report.userId === user.id) return;
    if (isManager(user) && report.status !== ReportStatus.DRAFT) return;
    throw new ForbiddenException(
      isManager(user) ? 'Draft reports are only visible to their author' : 'You can only access your own reports',
    );
  }

  /** Only the author may change report content - managers never can. */
  assertOwner(report: ReportCore, user: AuthUser) {
    if (report.userId === user.id) return;
    throw new ForbiddenException(
      isManager(user)
        ? 'Managers cannot modify report content; use the review actions instead'
        : 'You can only modify your own reports',
    );
  }

  assertEditable(report: ReportCore) {
    if (!EDITABLE_STATUSES.includes(report.status)) {
      throw new BadRequestException(`A report in status ${report.status} cannot be edited`);
    }
  }

  permissionsFor(report: ReportCore, user: AuthUser) {
    const owner = report.userId === user.id;
    const editable = EDITABLE_STATUSES.includes(report.status);
    return {
      canView: owner || (isManager(user) && report.status !== ReportStatus.DRAFT),
      canEdit: owner && editable,
      canSubmit: owner && editable,
      canDelete: owner && report.status === ReportStatus.DRAFT,
      canReview: isManager(user) && report.status === ReportStatus.SUBMITTED,
    };
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private withPermissions(report: ReportDetail, user: AuthUser) {
    return { ...report, permissions: this.permissionsFor(report, user) };
  }

  private buildWhere(query: ListReportsQueryDto, user: AuthUser): Prisma.ReportWhereInput {
    const where: Prisma.ReportWhereInput = {};
    if (isManager(user)) {
      if (query.memberId) where.userId = query.memberId;
    } else {
      where.userId = user.id; // team members are always scoped to their own reports
    }
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.weekStart) {
      where.weekStart = parseDateOnly(query.weekStart);
    } else if (query.from || query.to) {
      where.weekStart = {
        gte: query.from ? parseDateOnly(query.from) : undefined,
        lte: query.to ? parseDateOnly(query.to) : undefined,
      };
    }
    return where;
  }

  private async getCoreOrThrow<S extends Prisma.ReportSelect>(id: string, extraSelect?: S) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, weekStart: true, projectId: true, currentVersion: true, ...extraSelect },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  private parseWeekStart(value: string): Date {
    let date: Date;
    try {
      date = parseDateOnly(value);
    } catch {
      throw new BadRequestException('weekStart must be a valid date in YYYY-MM-DD format');
    }
    if (!isMonday(date)) throw new BadRequestException('weekStart must be a Monday');
    return date;
  }

  private validateContent(dto: UpsertReportDto) {
    this.assertSingleKeyItem(dto.blockers, 'blocker');
    this.assertSingleKeyItem(dto.achievements, 'achievement');
    const categories = (dto.hours ?? []).map((h) => h.category);
    if (new Set(categories).size !== categories.length) {
      throw new BadRequestException('Each work category may only appear once in the hours breakdown');
    }
  }

  private assertSingleKeyItem(items: ReportListItemDto[] | undefined, label: string) {
    const keyCount = (items ?? []).filter((item) => item.isKey).length;
    if (keyCount > 1) throw new BadRequestException(`Only one ${label} can be flagged as the key ${label}`);
  }

  /** A report may be saved as a draft while incomplete, but not submitted. */
  private assertComplete(report: ReportDetail) {
    const problems: string[] = [];
    if (report.tasks.length === 0) problems.push('add at least one task');
    if (!report.nextWeekPlan.trim()) problems.push('describe the tasks planned for next week');
    if (!report.projectId) problems.push('select a project');
    if (problems.length) {
      throw new BadRequestException(`The report is incomplete: ${problems.join(', ')}.`);
    }
  }

  private async assertProjectSelectable(projectId: string, currentProjectId?: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { active: true } });
    if (!project) throw new BadRequestException('The selected project does not exist');
    if (!project.active && projectId !== currentProjectId) {
      throw new BadRequestException('The selected project has been archived');
    }
  }

  /** Maps the DTO into the nested Prisma write for all content sections. */
  private contentData(dto: UpsertReportDto) {
    return {
      projectId: dto.projectId,
      nextWeekPlan: dto.nextWeekPlan?.trim() ?? '',
      notes: dto.notes?.trim() || null,
      links: dto.links?.trim() || null,
      tasks: {
        create: dto.tasks.map((task, index) => ({
          sortOrder: index,
          name: task.name.trim(),
          priority: task.priority,
          status: task.status,
          plannedPercent: task.plannedPercent,
          actualPercent: task.actualPercent,
          plannedHours: task.plannedHours,
          actualHours: task.actualHours,
          output: task.output?.trim() || null,
        })),
      },
      blockers: {
        create: (dto.blockers ?? []).map((item, index) => ({
          sortOrder: index,
          description: item.description.trim(),
          isKey: item.isKey === true,
        })),
      },
      achievements: {
        create: (dto.achievements ?? []).map((item, index) => ({
          sortOrder: index,
          description: item.description.trim(),
          isKey: item.isKey === true,
        })),
      },
      hours: {
        create: (dto.hours ?? []).filter((h) => h.hours > 0).map((h) => ({ category: h.category, hours: h.hours })),
      },
    };
  }

  private log(type: ActivityType, actorId: string, reportId: string, details?: Prisma.InputJsonValue) {
    return this.prisma.activityLog.create({ data: { type, actorId, reportId, details } });
  }
}
