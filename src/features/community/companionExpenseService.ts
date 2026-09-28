import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/api/supabaseClient';

/** 0053 companion_expenses 행 */
export interface CompanionExpense {
  id: string;
  post_id: string;
  payer_id: string;
  amount: number;
  currency: string;
  description: string;
  split_among: string[];
  created_by: string;
  created_at: string;
}

export function companionExpensesQueryKey(postId: string) {
  return ['community', 'companion', 'expenses', postId] as const;
}

async function listCompanionExpenses(postId: string): Promise<CompanionExpense[]> {
  const { data, error } = await getSupabaseClient()
    .from('companion_expenses')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // numeric은 문자열로 올 수 있어 숫자로 맞춘다
  return ((data ?? []) as CompanionExpense[]).map((e) => ({ ...e, amount: Number(e.amount) }));
}

export function useCompanionExpenses(postId: string | undefined) {
  return useQuery({
    queryKey: companionExpensesQueryKey(postId ?? ''),
    queryFn: () => listCompanionExpenses(postId!),
    enabled: !!postId,
  });
}

export interface NewCompanionExpense {
  payerId: string;
  amount: number;
  currency: string;
  description: string;
  splitAmong: string[];
}

export function useAddCompanionExpense(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewCompanionExpense) => {
      const { error } = await getSupabaseClient().rpc('add_companion_expense', {
        p_post_id: postId,
        p_payer_id: input.payerId,
        p_amount: input.amount,
        p_currency: input.currency,
        p_description: input.description,
        p_split_among: input.splitAmong,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companionExpensesQueryKey(postId) });
    },
  });
}

export function useDeleteCompanionExpense(postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (expenseId: string) => {
      const { error } = await getSupabaseClient().rpc('delete_companion_expense', { p_expense_id: expenseId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: companionExpensesQueryKey(postId) });
    },
  });
}
