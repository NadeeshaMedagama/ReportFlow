import type { MemberProfile, PublicUser, Role, TeamUser } from '@weekly-report/shared';
import { apiFetch } from '../api-client';

export interface UserListParams {
  role?: Role;
  includeInactive?: boolean;
  search?: string;
}

export const usersApi = {
  list: (params: UserListParams = {}) => apiFetch<TeamUser[]>('/users', { query: { ...params } }),
  profile: (id: string) => apiFetch<MemberProfile>(`/users/${id}`),
  create: (input: { name: string; email: string; password: string; role: Role; jobTitle?: string }) =>
    apiFetch<PublicUser>('/users', { method: 'POST', body: input }),
  update: (id: string, input: { name?: string; jobTitle?: string; role?: Role; active?: boolean }) =>
    apiFetch<PublicUser>(`/users/${id}`, { method: 'PATCH', body: input }),
  deactivate: (id: string) => apiFetch<PublicUser>(`/users/${id}`, { method: 'DELETE' }),
};
