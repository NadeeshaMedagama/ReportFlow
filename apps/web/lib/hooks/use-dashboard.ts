'use client';

import type { SectionKey } from '@weekly-report/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard';

export function useDashboardSummary(weekStart?: string) {
  return useQuery({
    queryKey: ['dashboard', 'summary', weekStart],
    queryFn: () => dashboardApi.summary(weekStart),
    placeholderData: keepPreviousData,
  });
}

export function useSubmissionStatus(weekStart?: string, enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'submission-status', weekStart],
    queryFn: () => dashboardApi.submissionStatus(weekStart),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTasksTrend(weeks: number) {
  return useQuery({ queryKey: ['dashboard', 'tasks-trend', weeks], queryFn: () => dashboardApi.tasksTrend(weeks) });
}

export function useStatusByMember(weeks: number) {
  return useQuery({ queryKey: ['dashboard', 'status-by-member', weeks], queryFn: () => dashboardApi.statusByMember(weeks) });
}

export function useWorkloadByProject(weeks: number) {
  return useQuery({ queryKey: ['dashboard', 'workload', weeks], queryFn: () => dashboardApi.workloadByProject(weeks) });
}

export function useTimeByCategory(weeks: number) {
  return useQuery({ queryKey: ['dashboard', 'time-by-category', weeks], queryFn: () => dashboardApi.timeByCategory(weeks) });
}

export function useActivity(limit = 20) {
  return useQuery({ queryKey: ['dashboard', 'activity', limit], queryFn: () => dashboardApi.activity(limit) });
}

export function useSectionOverview(section: SectionKey, weekStart?: string, enabled = true) {
  return useQuery({
    queryKey: ['dashboard', 'section-overview', section, weekStart],
    queryFn: () => dashboardApi.sectionOverview(section, weekStart),
    placeholderData: keepPreviousData,
    enabled,
  });
}
