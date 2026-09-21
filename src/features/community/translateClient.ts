/**
 * 번역 보기 (06-community.md §8) — 결과는 호출부 state에만 두고 저장하지 않는다.
 */
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { Locale } from './types';

export async function translateText(text: string, source: string | null, target: Locale): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke<{ translated?: string; error?: string }>('translate', {
    body: { text, source: source ?? undefined, target },
  });
  if (error) throw error;
  if (!data?.translated) throw new Error(data?.error ?? '번역에 실패했습니다.');
  return data.translated;
}
