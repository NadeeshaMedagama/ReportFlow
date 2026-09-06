import { BadRequestException, Injectable } from '@nestjs/common';
import { ActivityType, Prisma, ReportStatus, Role, TaskStatus, WorkCategory } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  addWeeks,
  currentWeekStart,
  endOfWeek,
  formatWeekLabel,
  isMonday,
  parseDateOnly,
  submissionDeadline,
  toDateOnlyString,
} from '../common/week';
import { PUBLIC_USER_SELECT } from '../users/user.select';
import { SectionKey } from './dto/dashboard.query';

export const WORK_CATEGORY_LABELS: Record<WorkCategory, string> = {
  DEVELOPMENT: 'Development',
  TESTING: 'Testing',
  MEETINGS: 'Meetings',
  DOCUMENTATION: 'Documentation',
  DESIGN: 'Design',
  SUPPORT: 'Support',
  OTHER: 'Other',
};

export type SubmissionTiming = 'ON_TIME' | 'LATE' | 'PENDING' | 'OVERDUE';

const ACTIVE_MEMBERS: Prisma.UserWhereInput = { role: Role.TEAM_MEMBER, active: true };

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Parse an optional week query parameter, defaulting to the current week. */
  resolveWeek(weekStartInput?: string): Date {
    if (!weekStartInput) return currentWeekStart();
    let date: Date;
    try {
      date = parseDateOnly(weekStartInput);
    } catch {
      throw new BadRequestException('weekStart must be a valid date in YYYY-MM-DD format');
    }
    if (!isMonday(date)) throw new BadRequestException('weekStart must be a Monday');
    return date;
  }

  private describeWeek(weekStart: Date) {
    const weekEnd = endOfWeek(weekStart);
    const deadline = submissionDeadline(weekEnd);
    return {
      weekStart: toDateOnlyString(weekStart),
      weekEnd: toDateOnlyString(weekEnd),
      label: formatWeekLabel(weekStart),
      deadline: deadline.toISOString(),
      deadlinePassed: Date.now() > deadline.getTime(),
      isCurrentWeek: weekStart.getTime() === currentWeekStart().getTime(),
    };
  }

  // ---------------------------------------------------------------------
  // Summary metrics
  // ---------------------------------------------------------------------

  async summary(weekStartInput?: string) {
    const weekStart = this.resolveWeek(weekStartInput);
    const week = this.describeWeek(weekStart);
    const deadline = new Date(week.deadline);

    const [totalMembers, reports, needsCorrectionTotal, awaitingReviewTotal] = await Promise.all([
      this.prisma.user.count({ where: ACTIVE_MEMBERS }),
      this.prisma.report.findMany({
        where: { weekStart, user: ACTIVE_MEMBERS },
        select: { status: true, firstSubmittedAt: true, blockers: { select: { isKey: true } } },
      }),
      this.prisma.report.count({ where: { status: ReportStatus.NEEDS_CORRECTION } }),
      this.prisma.report.count({ where: { status: ReportStatus.SUBMITTED } }),
    ]);

    const byStatus = countByStatus(reports);
    const submitted = reports.filter((r) => r.firstSubmittedAt !== null);
    const onTime = submitted.filter((r) => r.firstSubmittedAt! <= deadline).length;
    const nonDraft = reports.filter((r) => r.status !== ReportStatus.DRAFT);

    return {
      week,
      totalMembers,
      submitted: submitted.length,
      onTime,
      late: submitted.length - onTime,
      pending: Math.max(0, totalMembers - submitted.length),
      notStarted: Math.max(0, totalMembers - reports.length),
      drafts: byStatus.DRAFT,
      complianceRate: totalMembers ? Math.round((submitted.length / totalMembers) * 100) : 0,
      byStatus,
      awaitingReview: byStatus.SUBMITTED,
      needsCorrection: byStatus.NEEDS_CORRECTION,
      approved: byStatus.APPROVED,
      needsCorrectionTotal,
      awaitingReviewTotal,
      openBlockers: nonDraft.reduce((sum, r) => sum + r.blockers.length, 0),
      keyBlockers: nonDraft.reduce((sum, r) => sum + r.blockers.filter((b) => b.isKey).length, 0),
    };
  }

  /** One row per active team member for the selected week, including "not started". */
  async submissionStatus(weekStartInput?: string) {
    const weekStart = this.resolveWeek(weekStartInput);
    const week = this.describeWeek(weekStart);
    const deadline = new Date(week.deadline);
    const now = new Date();

    const [members, reports] = await Promise.all([
      this.prisma.user.findMany({ where: ACTIVE_MEMBERS, select: PUBLIC_USER_SELECT, orderBy: { name: 'asc' } }),
      this.prisma.report.findMany({
        where: { weekStart },
        select: {
          id: true,
          userId: true,
          status: true,
          firstSubmittedAt: true,
          submittedAt: true,
          reviewedAt: true,
          currentVersion: true,
          project: { select: { id: true, name: true } },
          _count: { select: { tasks: true, blockers: true } },
        },
      }),
    ]);
    const byUser = new Map(reports.map((r) => [r.userId, r]));

    const rows = members.map((member) => {
      const report = byUser.get(member.id) ?? null;
      let timing: SubmissionTiming;
      if (!report?.firstSubmittedAt) timing = now > deadline ? 'OVERDUE' : 'PENDING';
      else timing = report.firstSubmittedAt <= deadline ? 'ON_TIME' : 'LATE';
      return { user: member, report, status: report?.status ?? ('NOT_STARTED' as const), timing };
    });

    return { week, rows };
  }

  // ---------------------------------------------------------------------
  // Chart datasets
  // ---------------------------------------------------------------------

  /** Completed tasks per week, team-wide and per member (for a stacked/line chart). */
  async tasksTrend(weeks: number) {
    const from = addWeeks(currentWeekStart(), -(weeks - 1));
    const reports = await this.prisma.report.findMany({
      where: { weekStart: { gte: from }, status: { not: ReportStatus.DRAFT } },
      select: {
        weekStart: true,
        user: { select: { id: true, name: true } },
        tasks: { select: { status: true, actualHours: true } },
      },
    });

    const series = Array.from(new Set(reports.map((r) => r.user.name))).sort();
    const rows = Array.from({ length: weeks }, (_, i) => {
      const weekStart = addWeeks(from, i);
      const row: Record<string, number | string> = {
        weekStart: toDateOnlyString(weekStart),
        label: shortWeekLabel(weekStart),
        completed: 0,
        tasks: 0,
        hours: 0,
      };
      for (const name of series) row[name] = 0;
      return row;
    });
    const indexByWeek = new Map(rows.map((row, i) => [row.weekStart as string, i]));

    for (const report of reports) {
      const row = rows[indexByWeek.get(toDateOnlyString(report.weekStart)) ?? -1];
      if (!row) continue;
      const completed = report.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      row.completed = (row.completed as number) + completed;
      row.tasks = (row.tasks as number) + report.tasks.length;
      row.hours = round1((row.hours as number) + report.tasks.reduce((s, t) => s + t.actualHours, 0));
      row[report.user.name] = (row[report.user.name] as number) + completed;
    }
    return { weeks, series, rows };
  }

  /** Report status counts per member over the window (stacked bar). */
  async statusByMember(weeks: number) {
    const from = addWeeks(currentWeekStart(), -(weeks - 1));
    const [members, reports] = await Promise.all([
      this.prisma.user.findMany({ where: ACTIVE_MEMBERS, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.report.findMany({
        where: { weekStart: { gte: from } },
        select: { userId: true, status: true },
      }),
    ]);

    const rows = members.map((member) => {
      const mine = reports.filter((r) => r.userId === member.id);
      const counts = countByStatus(mine);
      return { userId: member.id, name: member.name, ...counts, NOT_STARTED: Math.max(0, weeks - mine.length) };
    });
    return { weeks, rows };
  }

  /** Work distribution by project: reports, tasks, hours and people involved. */
  async workloadByProject(weeks: number) {
    const from = addWeeks(currentWeekStart(), -(weeks - 1));
    const reports = await this.prisma.report.findMany({
      where: { weekStart: { gte: from }, status: { not: ReportStatus.DRAFT } },
      select: {
        userId: true,
        project: { select: { id: true, name: true } },
        tasks: { select: { status: true, actualHours: true } },
      },
    });

    const byProject = new Map<
      string,
      { projectId: string; name: string; reports: number; tasks: number; completedTasks: number; hours: number; members: Set<string> }
    >();
    for (const report of reports) {
      const entry = byProject.get(report.project.id) ?? {
        projectId: report.project.id,
        name: report.project.name,
        reports: 0,
        tasks: 0,
        completedTasks: 0,
        hours: 0,
        members: new Set<string>(),
      };
      entry.reports += 1;
      entry.tasks += report.tasks.length;
      entry.completedTasks += report.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
      entry.hours += report.tasks.reduce((s, t) => s + t.actualHours, 0);
      entry.members.add(report.userId);
      byProject.set(report.project.id, entry);
    }

    const rows = Array.from(byProject.values())
      .map(({ members, hours, ...rest }) => ({ ...rest, hours: round1(hours), members: members.size }))
      .sort((a, b) => b.hours - a.hours);
    return { weeks, rows };
  }

  /** Team-wide hours by work category (from the optional hours section). */
  async timeByCategory(weeks: number) {
    const from = addWeeks(currentWeekStart(), -(weeks - 1));
    const grouped = await this.prisma.hoursEntry.groupBy({
      by: ['category'],
      _sum: { hours: true },
      where: { report: { weekStart: { gte: from }, status: { not: ReportStatus.DRAFT } } },
    });
    const total = grouped.reduce((sum, g) => sum + (g._sum.hours ?? 0), 0);
    const rows = Object.values(WorkCategory)
      .map((category) => {
        const hours = grouped.find((g) => g.category === category)?._sum.hours ?? 0;
        return {
          category,
          label: WORK_CATEGORY_LABELS[category],
          hours: round1(hours),
          share: total ? Math.round((hours / total) * 100) : 0,
        };
      })
      .filter((row) => row.hours > 0)
      .sort((a, b) => b.hours - a.hours);
    return { weeks, total: round1(total), rows };
  }

  // ---------------------------------------------------------------------
  // Activity feed and side-by-side section overview
  // ---------------------------------------------------------------------

  async activity(limit: number) {
    const entries = await this.prisma.activityLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, role: true } },
        report: { select: { id: true, weekStart: true, status: true, user: { select: { id: true, name: true } } } },
      },
    });
    return entries.map((entry) => {
      const report = entry.report
        ? {
            id: entry.report.id,
            weekStart: toDateOnlyString(entry.report.weekStart),
            weekLabel: formatWeekLabel(entry.report.weekStart),
            status: entry.report.status,
            owner: entry.report.user,
          }
        : null;
      return {
        id: entry.id,
        type: entry.type,
        createdAt: entry.createdAt,
        actor: entry.actor,
        report,
        details: entry.details,
        message: describeActivity(entry.type, entry.actor?.name ?? 'Someone', report, entry.details),
      };
    });
  }

  /** One section (blockers, achievements, next-week plan or tasks) across all members for a week. */
  async sectionOverview(weekStartInput: string | undefined, section: SectionKey) {
    const weekStart = this.resolveWeek(weekStartInput);
    const reports = await this.prisma.report.findMany({
      where: { weekStart, status: { not: ReportStatus.DRAFT } },
      include: {
        user: { select: PUBLIC_USER_SELECT },
        project: { select: { id: true, name: true } },
        blockers: { orderBy: { sortOrder: 'asc' } },
        achievements: { orderBy: { sortOrder: 'asc' } },
        tasks: { orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    const entries = reports.map((report) => ({
      reportId: report.id,
      user: report.user,
      project: report.project,
      status: report.status,
      items:
        section === 'BLOCKERS'
          ? report.blockers.map((b) => ({ description: b.description, isKey: b.isKey }))
          : section === 'ACHIEVEMENTS'
            ? report.achievements.map((a) => ({ description: a.description, isKey: a.isKey }))
            : [],
      text: section === 'NEXT_WEEK' ? report.nextWeekPlan : null,
      tasks: section === 'TASKS' ? report.tasks : [],
    }));

    return { week: this.describeWeek(weekStart), section, entries };
  }
}

// -------------------------------------------------------------------------
// helpers
// -------------------------------------------------------------------------

function countByStatus(reports: Array<{ status: ReportStatus }>): Record<ReportStatus, number> {
  const counts = Object.fromEntries(Object.values(ReportStatus).map((s) => [s, 0])) as Record<ReportStatus, number>;
  for (const report of reports) counts[report.status] += 1;
  return counts;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function shortWeekLabel(weekStart: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(weekStart);
}

type ActivityReport = { weekLabel: string; owner: { name: string } } | null;

function describeActivity(type: ActivityType, actor: string, report: ActivityReport, details: Prisma.JsonValue): string {
  const d = (details ?? {}) as Record<string, unknown>;
  const week = report ? `the week of ${report.weekLabel}` : 'a week';
  const owner = report?.owner.name ?? 'a team member';
  switch (type) {
    case ActivityType.REPORT_CREATED:
      return `${actor} started a report for ${week}`;
    case ActivityType.REPORT_SUBMITTED:
      return `${actor} submitted their report for ${week}`;
    case ActivityType.REPORT_RESUBMITTED:
      return `${actor} resubmitted their report for ${week} (version ${d.versionNumber ?? '?'})`;
    case ActivityType.REPORT_APPROVED:
      return `${actor} approved ${owner}'s report for ${week}`;
    case ActivityType.REPORT_CHANGES_REQUESTED:
      return `${actor} requested changes on ${owner}'s report for ${week}`;
    case ActivityType.PROJECT_CREATED:
      return `${actor} created the project "${d.projectName ?? ''}"`;
    case ActivityType.PROJECT_UPDATED:
      return `${actor} updated the project "${d.projectName ?? ''}"`;
    case ActivityType.PROJECT_DELETED:
      return `${actor} ${d.archived ? 'archived' : 'deleted'} the project "${d.projectName ?? ''}"`;
    case ActivityType.USER_REGISTERED:
      return `${actor} registered an account`;
    case ActivityType.USER_INVITED:
      return `${actor} invited a new ${String(d.role ?? 'user').toLowerCase().replace('_', ' ')}`;
    case ActivityType.USER_ROLE_CHANGED:
      return `${actor} changed a user's role from ${d.from ?? '?'} to ${d.to ?? '?'}`;
    case ActivityType.USER_DEACTIVATED:
      return `${actor} deactivated a user account`;
    case ActivityType.USER_REACTIVATED:
      return `${actor} reactivated a user account`;
    default:
      return `${actor} performed ${type}`;
  }
}
