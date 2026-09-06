'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { assistantApi } from '../api/assistant';

export function useAssistantStatus(enabled = true) {
  return useQuery({ queryKey: ['assistant', 'status'], queryFn: assistantApi.status, staleTime: 5 * 60_000, enabled });
}

export function useTeamSummary() {
  return useMutation({ mutationFn: (weekStart?: string) => assistantApi.teamSummary(weekStart) });
}
