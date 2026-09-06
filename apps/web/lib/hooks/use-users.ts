'use client';

import type { Role } from '@weekly-report/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usersApi, type UserListParams } from '../api/users';

export function useUsers(params: UserListParams = {}, enabled = true) {
  return useQuery({ queryKey: ['users', params], queryFn: () => usersApi.list(params), enabled });
}

export function useMemberProfile(id: string | undefined) {
  return useQuery({ queryKey: ['user-profile', id], queryFn: () => usersApi.profile(id!), enabled: !!id });
}

export function useUserMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const create = useMutation({
    mutationFn: (input: { name: string; email: string; password: string; role: Role; jobTitle?: string }) =>
      usersApi.create(input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; jobTitle?: string; role?: Role; active?: boolean } }) =>
      usersApi.update(id, input),
    onSuccess: invalidate,
  });
  const deactivate = useMutation({ mutationFn: (id: string) => usersApi.deactivate(id), onSuccess: invalidate });
  return { create, update, deactivate };
}
