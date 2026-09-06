'use client';

import type { ReportInput, ReviewDecision } from '@weekly-report/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportsApi, type ReportListParams } from '../api/reports';

export function useReports(params: ReportListParams, enabled = true) {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: () => reportsApi.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useReport(id: string | undefined) {
  return useQuery({ queryKey: ['report', id], queryFn: () => reportsApi.get(id!), enabled: !!id });
}

export function useReportVersions(id: string | undefined) {
  return useQuery({ queryKey: ['report-versions', id], queryFn: () => reportsApi.versions(id!), enabled: !!id });
}

export function useReportVersion(id: string | undefined, versionId: string | undefined) {
  return useQuery({
    queryKey: ['report-version', id, versionId],
    queryFn: () => reportsApi.version(id!, versionId!),
    enabled: !!id && !!versionId,
  });
}

export function useReportMutations() {
  const queryClient = useQueryClient();
  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['reports'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['report', id] });
      queryClient.invalidateQueries({ queryKey: ['report-versions', id] });
    }
  };

  const create = useMutation({ mutationFn: (input: ReportInput) => reportsApi.create(input), onSuccess: () => invalidate() });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReportInput }) => reportsApi.update(id, input),
    onSuccess: (report) => invalidate(report.id),
  });
  const remove = useMutation({ mutationFn: (id: string) => reportsApi.remove(id), onSuccess: () => invalidate() });
  const submit = useMutation({ mutationFn: (id: string) => reportsApi.submit(id), onSuccess: (report) => invalidate(report.id) });
  const review = useMutation({
    mutationFn: ({ id, decision, comment }: { id: string; decision: ReviewDecision; comment?: string }) =>
      reportsApi.review(id, decision, comment),
    onSuccess: (report) => invalidate(report.id),
  });
  return { create, update, remove, submit, review };
}
