import type { RoundInput } from '@golf-sg/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from './context';
import { useBaselineId } from './preferences';

export const queryKeys = {
  rounds: (baselineId: string) => ['rounds', baselineId] as const,
  round: (id: string, baselineId: string) => ['rounds', id, baselineId] as const,
  stats: (limit: number | undefined, baselineId: string) =>
    ['stats', limit ?? 'all', baselineId] as const,
};

export function useRounds() {
  const store = useStore();
  const baselineId = useBaselineId();
  return useQuery({
    queryKey: queryKeys.rounds(baselineId),
    queryFn: () => store.listRounds(baselineId),
    placeholderData: keepPreviousData,
  });
}

export function useRound(id: string | undefined) {
  const store = useStore();
  const baselineId = useBaselineId();
  return useQuery({
    queryKey: queryKeys.round(id ?? '', baselineId),
    queryFn: () => store.getRound(id ?? '', baselineId),
    enabled: id !== undefined,
    // Keep the page up while the baseline changes, but never show another round's data.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === id ? previous : undefined,
  });
}

export function useStats(limit?: number) {
  const store = useStore();
  const baselineId = useBaselineId();
  return useQuery({
    queryKey: queryKeys.stats(limit, baselineId),
    queryFn: () => store.getStats(limit, baselineId),
    // Changing the range or baseline must not blank the page while the new numbers load.
    placeholderData: keepPreviousData,
  });
}

function useMutate<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries() });
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
