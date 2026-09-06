import type { Project } from '@weekly-report/shared';
import { apiFetch } from '../api-client';

export interface ProjectInput {
  name: string;
  description?: string;
  memberIds?: string[];
}

/** Partial update; `active` restores an archived project. */
export interface ProjectUpdateInput extends Partial<ProjectInput> {
  active?: boolean;
}

export const projectsApi = {
  list: (includeInactive = false) => apiFetch<Project[]>('/projects', { query: { includeInactive } }),
  get: (id: string) => apiFetch<Project>(`/projects/${id}`),
  create: (input: ProjectInput) => apiFetch<Project>('/projects', { method: 'POST', body: input }),
  update: (id: string, input: ProjectUpdateInput) => apiFetch<Project>(`/projects/${id}`, { method: 'PATCH', body: input }),
  remove: (id: string) => apiFetch<{ id: string; archived: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
};
