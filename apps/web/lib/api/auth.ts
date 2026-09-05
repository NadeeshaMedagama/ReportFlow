import type { PublicUser, Session } from '@weekly-report/shared';
import { apiFetch } from '../api-client';

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<Session>('/auth/login', { method: 'POST', body: { email, password }, anonymous: true }),
  register: (input: { name: string; email: string; password: string; jobTitle?: string }) =>
    apiFetch<Session>('/auth/register', { method: 'POST', body: input, anonymous: true }),
  me: () => apiFetch<PublicUser>('/auth/me'),
  updateProfile: (input: { name?: string; jobTitle?: string }) =>
    apiFetch<PublicUser>('/auth/me', { method: 'PATCH', body: input }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    apiFetch<{ success: boolean }>('/auth/change-password', { method: 'POST', body: input }),
};
