import type { CourseInput, RoundInput } from '@golf-sg/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from './context';
import { useBaselineId } from './preferences';

export const queryKeys = {
  courses: ['courses'] as const,
  rounds: (baselineId: string) => ['rounds', baselineId] as const,
  round: (id: string, baselineId: string) => ['rounds', id, baselineId] as const,
  stats: (limit: number | undefined, baselineId: string) =>
    ['stats', limit ?? 'all', baselineId] as const,
};

export function useCourses() {
  const store = useStore();
  return useQuery({ queryKey: queryKeys.courses, queryFn: () => store.listCourses() });
}

export function useRounds() {
  const store = useStore();
  const baselineId = useBaselineId();
  return useQuery({
    queryKey: queryKeys.rounds(baselineId),
    queryFn: () => store.listRounds(baselineId),
  });
}

export function useRound(id: string | undefined) {
  const store = useStore();
  const baselineId = useBaselineId();
  return useQuery({
    queryKey: queryKeys.round(id ?? '', baselineId),
    queryFn: () => store.getRound(id ?? '', baselineId),
    enabled: id !== undefined,
  });
}

export function useStats(limit?: number) {
  const store = useStore();
  const baselineId = useBaselineId();
  return useQuery({
    queryKey: queryKeys.stats(limit, baselineId),
    queryFn: () => store.getStats(limit, baselineId),
  });
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
