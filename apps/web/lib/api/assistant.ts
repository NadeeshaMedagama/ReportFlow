import type { AssistantStatus, ChatMessage, ChatResponse, TeamSummaryResponse } from '@weekly-report/shared';
import { apiFetch } from '../api-client';

export const assistantApi = {
  status: () => apiFetch<AssistantStatus>('/assistant/status'),
  chat: (messages: ChatMessage[]) => apiFetch<ChatResponse>('/assistant/chat', { method: 'POST', body: { messages } }),
  teamSummary: (weekStart?: string) =>
    apiFetch<TeamSummaryResponse>('/assistant/team-summary', { method: 'POST', body: { weekStart } }),
};
