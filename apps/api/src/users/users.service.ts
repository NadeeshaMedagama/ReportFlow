import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, Prisma, ReportStatus, Role, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  addWeeks,
  currentWeekStart,
  formatWeekLabel,
  submissionDeadline,
  toDateOnlyString,
} from '../common/week';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query';
import { UpdateUserDto } from './dto/update-user.dto';
import { PUBLIC_USER_SELECT } from './user.select';

const PROFILE_WEEKS = 8;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListUsersQueryDto) {
    const where: Prisma.UserWhereInput = {};
    if (!query.includeInactive) where.active = true;
    if (query.role) where.role = query.role;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      select: {
        ...PUBLIC_USER_SELECT,
        projectMemberships: { select: { project: { select: { id: true, name: true, active: true } } } },
        _count: { select: { reports: true } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });

    return users.map(({ projectMemberships, _count, ...user }) => ({
      ...user,
      projects: projectMemberships.map((m) => m.project),
      reportCount: _count.reports,
    }));
  }

  /** Team member profile: basic info, aggregate stats and a weekly series. */
  async getProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        ...PUBLIC_USER_SELECT,
        projectMemberships: { select: { project: { select: { id: true, name: true, active: true } } } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const reports = await this.prisma.report.findMany({
      where: { userId: id },
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        status: true,
        firstSubmittedAt: true,
        currentVersion: true,
        tasks: { select: { status: true, actualHours: true } },
        _count: { select: { blockers: true, achievements: true } },
      },
      orderBy: { weekStart: 'desc' },
    });

    const submitted = reports.filter((r) => r.firstSubmittedAt);
    const nonDraft = reports.filter((r) => r.status !== ReportStatus.DRAFT);
    const approved = reports.filter((r) => r.status === ReportStatus.APPROVED);
    const onTime = submitted.filter((r) => r.firstSubmittedAt! <= submissionDeadline(r.weekEnd));
    const totalHours = nonDraft.reduce((sum, r) => sum + r.tasks.reduce((s, t) => s + t.actualHours, 0), 0);
    const tasksCompleted = nonDraft.reduce(
      (sum, r) => sum + r.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length,
      0,
    );

    const byStatus = Object.fromEntries(Object.values(ReportStatus).map((s) => [s, 0])) as Record<ReportStatus, number>;
    for (const r of reports) byStatus[r.status] += 1;

    const stats = {
      totalReports: reports.length,
      byStatus,
      submittedReports: submitted.length,
      approvalRate: submitted.length ? Math.round((approved.length / submitted.length) * 100) : 0,
      onTimeRate: submitted.length ? Math.round((onTime.length / submitted.length) * 100) : 0,
      tasksCompleted,
      totalHours: Math.round(totalHours * 10) / 10,
      avgHoursPerWeek: nonDraft.length ? Math.round((totalHours / nonDraft.length) * 10) / 10 : 0,
      correctionCycles: reports.reduce((sum, r) => sum + Math.max(0, r.currentVersion - 1), 0),
      openBlockers: nonDraft.reduce((sum, r) => sum + r._count.blockers, 0),
    };

    // Weekly series for the last N weeks (oldest first) used by the profile chart.
    const thisWeek = currentWeekStart();
    const byWeek = new Map(reports.map((r) => [toDateOnlyString(r.weekStart), r]));
    const weekly = Array.from({ length: PROFILE_WEEKS }, (_, i) => {
      const weekStart = addWeeks(thisWeek, i - (PROFILE_WEEKS - 1));
      const report = byWeek.get(toDateOnlyString(weekStart));
      return {
        weekStart: toDateOnlyString(weekStart),
        label: formatWeekLabel(weekStart),
        reportId: report?.id ?? null,
        status: report?.status ?? 'NOT_STARTED',
        hours: report ? Math.round(report.tasks.reduce((s, t) => s + t.actualHours, 0) * 10) / 10 : 0,
        tasksCompleted: report ? report.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length : 0,
      };
    });

    const { projectMemberships, ...publicUser } = user;
    return { user: { ...publicUser, projects: projectMemberships.map((m) => m.project) }, stats, weekly };
  }

  async create(dto: CreateUserDto, actor: AuthUser) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('An account with this email already exists');

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        role: dto.role,
        jobTitle: dto.jobTitle?.trim() || null,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
      select: PUBLIC_USER_SELECT,
    });
    await this.prisma.activityLog.create({
      data: { type: ActivityType.USER_INVITED, actorId: actor.id, details: { userId: user.id, role: user.role } },
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUser) {
    const target = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
    if (!target) throw new NotFoundException('User not found');

    const changesOwnRole = id === actor.id && dto.role !== undefined && dto.role !== target.role;
    const deactivatesSelf = id === actor.id && dto.active === false;
    if (changesOwnRole || deactivatesSelf) {
      throw new BadRequestException('You cannot change your own role or deactivate your own account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        jobTitle: dto.jobTitle === undefined ? undefined : dto.jobTitle.trim() || null,
        role: dto.role,
        active: dto.active,
      },
      select: PUBLIC_USER_SELECT,
    });

    if (dto.role !== undefined && dto.role !== target.role) {
      await this.prisma.activityLog.create({
        data: {
          type: ActivityType.USER_ROLE_CHANGED,
          actorId: actor.id,
          details: { userId: id, from: target.role, to: dto.role },
        },
      });
    }
    if (dto.active !== undefined && dto.active !== target.active) {
      await this.prisma.activityLog.create({
        data: {
          type: dto.active ? ActivityType.USER_REACTIVATED : ActivityType.USER_DEACTIVATED,
          actorId: actor.id,
          details: { userId: id },
        },
      });
    }
    return updated;
  }

  /** "Remove" a team member: accounts are deactivated, never hard-deleted, so report history survives. */
  deactivate(id: string, actor: AuthUser) {
    return this.update(id, { active: false }, actor);
  }

  /** Roles a user can be assigned to by an admin (exposed for the UI). */
  roles(): Role[] {
    return Object.values(Role);
  }
}
