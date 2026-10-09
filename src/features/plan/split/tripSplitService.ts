import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { ExpenseCategory } from '../types';
import type { TripSplitExpense, TripSplitTransfer } from './splitModel';

/**
 * 여행 더치페이(0108) — 경비와 따로 둔 장부. 여행(trips) 행을 건드리지 않으므로 일정 저장과 충돌하지 않는다.
 * 실시간 구독은 쓰지 않는다(0059) — 창이 다시 보일 때·30초마다 다시 읽는다.
 */
const REFRESH_MS = 30_000;

export const tripSplitKeys = {
  expenses: (tripId: string) => ['trip-split', tripId, 'expenses'] as const,
  transfers: (tripId: string) => ['trip-split', tripId, 'transfers'] as const,
};

/** numeric은 문자열로 올 수 있어 숫자로 맞춘다 */
function toExpense(row: Record<string, unknown>): TripSplitExpense {
  return {
    ...(row as unknown as TripSplitExpense),
    amount: Number(row.amount),
    fx_rate_to_base: row.fx_rate_to_base != null ? Number(row.fx_rate_to_base) : null,
  };
}

export function useTripSplitExpenses(tripId: string | undefined) {
  return useQuery({
    queryKey: tripSplitKeys.expenses(tripId ?? ''),
    enabled: !!tripId,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<TripSplitExpense[]> => {
      const { data, error } = await getSupabaseClient()
        .from('trip_split_expenses')
        .select('*')
        .eq('trip_id', tripId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(toExpense);
    },
  });
}

export function useTripSplitTransfers(tripId: string | undefined) {
  return useQuery({
    queryKey: tripSplitKeys.transfers(tripId ?? ''),
    enabled: !!tripId,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<TripSplitTransfer[]> => {
      const { data, error } = await getSupabaseClient()
        .from('trip_split_transfers')
        .select('*')
        .eq('trip_id', tripId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...(r as unknown as TripSplitTransfer), amount: Number(r.amount) }));
    },
  });
}

export interface SplitExpenseInput {
  dayIndex: number | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  currency: string;
  /** 여행 기본 통화가 아닐 때 적는 당시 환율(1 통화 = 몇 기본 통화) */
  fxRateToBase: number | null;
  payerId: string;
  splitAmong: string[];
}

function rpcArgs(input: SplitExpenseInput) {
  return {
    p_day_index: input.dayIndex,
    p_category: input.category,
    p_description: input.description,
    p_amount: input.amount,
    p_currency: input.currency,
    p_fx_rate_to_base: input.fxRateToBase,
    p_payer_id: input.payerId,
    p_split_among: input.splitAmong,
  };
}

export function useAddSplitExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SplitExpenseInput) => {
      const { error } = await getSupabaseClient().rpc('add_trip_split_expense', { p_trip_id: tripId, ...rpcArgs(input) });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripSplitKeys.expenses(tripId) }),
  });
}

export function useUpdateSplitExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SplitExpenseInput }) => {
      const { error } = await getSupabaseClient().rpc('update_trip_split_expense', { p_expense_id: id, ...rpcArgs(input) });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripSplitKeys.expenses(tripId) }),
  });
}

export function useDeleteSplitExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient().rpc('delete_trip_split_expense', { p_expense_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripSplitKeys.expenses(tripId) }),
  });
}

export function useAddSplitTransfer(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { from: string; to: string; amount: number; currency: string }) => {
      const { error } = await getSupabaseClient().rpc('add_trip_split_transfer', {
        p_trip_id: tripId,
        p_from: input.from,
        p_to: input.to,
        p_amount: input.amount,
        p_currency: input.currency,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripSplitKeys.transfers(tripId) }),
  });
}

export function useDeleteSplitTransfer(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabaseClient().rpc('delete_trip_split_transfer', { p_transfer_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tripSplitKeys.transfers(tripId) }),
  });
}
