import { Prisma, TaskPriority, TaskStatus, WorkCategory } from '@prisma/client';
import { toDateOnlyString } from '../common/week';

/**
 * Shape of the immutable content snapshot stored in ReportVersion.snapshot.
 * It contains only the member-authored content (no status / review data) so
 * every past version can be rendered with the same read-only view.
 */
export interface ReportSnapshot {
  weekStart: string;
  weekEnd: string;
  project: { id: string; name: string } | null;
  tasks: Array<{
    name: string;
    priority: TaskPriority;
    status: TaskStatus;
    plannedPercent: number;
    actualPercent: number;
    plannedHours: number;
    actualHours: number;
    output: string | null;
  }>;
  nextWeekPlan: string;
  blockers: Array<{ description: string; isKey: boolean }>;
  achievements: Array<{ description: string; isKey: boolean }>;
  hours: Array<{ category: WorkCategory; hours: number }>;
  notes: string | null;
  links: string | null;
}

type SnapshotSource = {
  weekStart: Date;
  weekEnd: Date;
  project: { id: string; name: string } | null;
  nextWeekPlan: string;
  notes: string | null;
  links: string | null;
  tasks: ReportSnapshot['tasks'] extends Array<infer T> ? Array<T & { sortOrder?: number }> : never;
  blockers: Array<{ description: string; isKey: boolean; sortOrder?: number }>;
  achievements: Array<{ description: string; isKey: boolean; sortOrder?: number }>;
  hours: Array<{ category: WorkCategory; hours: number }>;
};

export function buildSnapshot(report: SnapshotSource): ReportSnapshot {
  const bySortOrder = <T extends { sortOrder?: number }>(items: T[]) =>
    [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return {
    weekStart: toDateOnlyString(report.weekStart),
    weekEnd: toDateOnlyString(report.weekEnd),
    project: report.project ? { id: report.project.id, name: report.project.name } : null,
    tasks: bySortOrder(report.tasks).map((t) => ({
      name: t.name,
      priority: t.priority,
      status: t.status,
      plannedPercent: t.plannedPercent,
      actualPercent: t.actualPercent,
      plannedHours: t.plannedHours,
      actualHours: t.actualHours,
      output: t.output ?? null,
    })),
    nextWeekPlan: report.nextWeekPlan,
    blockers: bySortOrder(report.blockers).map((b) => ({ description: b.description, isKey: b.isKey })),
    achievements: bySortOrder(report.achievements).map((a) => ({ description: a.description, isKey: a.isKey })),
    hours: report.hours.map((h) => ({ category: h.category, hours: h.hours })),
    notes: report.notes ?? null,
    links: report.links ?? null,
  };
}

/** Prisma needs the plain JSON type for the Json column. */
export function snapshotToJson(snapshot: ReportSnapshot): Prisma.InputJsonValue {
  return snapshot as unknown as Prisma.InputJsonValue;
}
