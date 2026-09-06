'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, type ProjectInput, type ProjectUpdateInput } from '../api/projects';

export function useProjects(includeInactive = false) {
  return useQuery({ queryKey: ['projects', { includeInactive }], queryFn: () => projectsApi.list(includeInactive) });
}

export function useProjectMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
  const create = useMutation({ mutationFn: (input: ProjectInput) => projectsApi.create(input), onSuccess: invalidate });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProjectUpdateInput }) => projectsApi.update(id, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({ mutationFn: (id: string) => projectsApi.remove(id), onSuccess: invalidate });
  return { create, update, remove };
}
