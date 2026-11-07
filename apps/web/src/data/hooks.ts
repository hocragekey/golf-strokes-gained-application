import type { CourseInput, RoundInput } from '@golf-sg/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from './context';

export const queryKeys = {
  courses: ['courses'] as const,
  rounds: ['rounds'] as const,
  round: (id: string) => ['rounds', id] as const,
  stats: (limit?: number) => ['stats', limit ?? 'all'] as const,
};

export function useCourses() {
  const store = useStore();
  return useQuery({ queryKey: queryKeys.courses, queryFn: () => store.listCourses() });
}

export function useRounds() {
  const store = useStore();
  return useQuery({ queryKey: queryKeys.rounds, queryFn: () => store.listRounds() });
}

export function useRound(id: string | undefined) {
  const store = useStore();
  return useQuery({
    queryKey: queryKeys.round(id ?? ''),
    queryFn: () => store.getRound(id ?? ''),
    enabled: id !== undefined,
  });
}

export function useStats(limit?: number) {
  const store = useStore();
  return useQuery({ queryKey: queryKeys.stats(limit), queryFn: () => store.getStats(limit) });
}

function useMutate<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries() });
}

export function useSaveCourse(id?: string) {
  const store = useStore();
  return useMutate((input: CourseInput) => store.saveCourse(input, id));
}

export function useDeleteCourse() {
  const store = useStore();
  return useMutate((id: string) => store.deleteCourse(id));
}

export function useSaveRound(id?: string) {
  const store = useStore();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: RoundInput) => store.saveRound(input, id),
    onSuccess: () => client.invalidateQueries(),
  });
}

export function useDeleteRound() {
  const store = useStore();
  return useMutate((id: string) => store.deleteRound(id));
}

export function useImportBackup() {
  const store = useStore();
  return useMutate((data: unknown) => store.importBackup(data));
}
