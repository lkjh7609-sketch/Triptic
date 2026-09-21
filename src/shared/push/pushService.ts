import { getSupabaseClient } from '@/shared/api/supabaseClient';

export type PushPlatform = 'ios' | 'android' | 'web';

export async function savePushToken(userId: string, token: string, platform: PushPlatform): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform }, { onConflict: 'user_id,token' });
  if (error) throw error;
}

export async function deletePushToken(userId: string, token: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  if (error) throw error;
}
