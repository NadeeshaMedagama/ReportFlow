import type {
  Paginated,
  ReportDetail,
  ReportInput,
  ReportStatus,
  ReportSummary,
  ReportVersionDetail,
  ReportVersionSummary,
  ReviewDecision,
  ReviewEntry,
} from '@weekly-report/shared';
import { apiFetch } from '../api-client';

export interface ReportListParams {
  page?: number;
  limit?: number;
  status?: ReportStatus | '';
  memberId?: string;
  projectId?: string;
  weekStart?: string;
  from?: string;
  to?: string;
}

export const reportsApi = {
  list: (params: ReportListParams = {}) => apiFetch<Paginated<ReportSummary>>('/reports', { query: { ...params } }),
  get: (id: string) => apiFetch<ReportDetail>(`/reports/${id}`),
  create: (input: ReportInput) => apiFetch<ReportDetail>('/reports', { method: 'POST', body: input }),
  update: (id: string, input: ReportInput) => apiFetch<ReportDetail>(`/reports/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => apiFetch<{ id: string; deleted: boolean }>(`/reports/${id}`, { method: 'DELETE' }),
  submit: (id: string) => apiFetch<ReportDetail>(`/reports/${id}/submit`, { method: 'POST' }),
  review: (id: string, decision: ReviewDecision, comment?: string) =>
    apiFetch<ReportDetail>(`/reports/${id}/review`, { method: 'POST', body: { decision, comment } }),
  versions: (id: string) => apiFetch<ReportVersionSummary[]>(`/reports/${id}/versions`),
  version: (id: string, versionId: string) => apiFetch<ReportVersionDetail>(`/reports/${id}/versions/${versionId}`),
  reviews: (id: string) => apiFetch<ReviewEntry[]>(`/reports/${id}/reviews`),
};
