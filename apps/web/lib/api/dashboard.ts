import type {
  ActivityEntry,
  DashboardSummary,
  SectionKey,
  SectionOverviewResponse,
  StatusByMemberRow,
  SubmissionStatusResponse,
  TasksTrendResponse,
  TimeByCategoryResponse,
  WorkloadRow,
} from '@weekly-report/shared';
import { apiFetch } from '../api-client';

export const dashboardApi = {
  summary: (weekStart?: string) => apiFetch<DashboardSummary>('/dashboard/summary', { query: { weekStart } }),
  submissionStatus: (weekStart?: string) =>
    apiFetch<SubmissionStatusResponse>('/dashboard/submission-status', { query: { weekStart } }),
  tasksTrend: (weeks: number) => apiFetch<TasksTrendResponse>('/dashboard/tasks-trend', { query: { weeks } }),
  statusByMember: (weeks: number) =>
    apiFetch<{ weeks: number; rows: StatusByMemberRow[] }>('/dashboard/status-by-member', { query: { weeks } }),
  workloadByProject: (weeks: number) =>
    apiFetch<{ weeks: number; rows: WorkloadRow[] }>('/dashboard/workload-by-project', { query: { weeks } }),
  timeByCategory: (weeks: number) => apiFetch<TimeByCategoryResponse>('/dashboard/time-by-category', { query: { weeks } }),
  activity: (limit = 20) => apiFetch<ActivityEntry[]>('/dashboard/activity', { query: { limit } }),
  sectionOverview: (section: SectionKey, weekStart?: string) =>
    apiFetch<SectionOverviewResponse>('/dashboard/section-overview', { query: { section, weekStart } }),
};
