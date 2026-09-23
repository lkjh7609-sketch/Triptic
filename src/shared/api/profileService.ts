/**
 * 사용자 프로필 조회/수정 (02-screens.md §5 환경설정/알림 섹션)
 * profiles 테이블은 legacy(2.x)부터 이미 존재하고 own-row RLS(select/insert/update,
 * auth.uid() = id)가 적용돼 있다 — 이 서비스는 그 위에 얇게 얹는다.
 */
import { getSupabaseClient } from './supabaseClient';

export type Locale = 'ko' | 'en' | 'zh-CN' | 'ja';
export type TempUnit = 'c' | 'f';
export type DistanceUnit = 'km' | 'mi';

export interface NotificationPrefs {
  preDeparture: boolean;
  flightChanges: boolean;
  communityReplies: boolean;
  marketing: boolean;
}

export interface ProfileRow {
  id: string;
  display_name: string;
  locale: Locale;
  temp_unit: TempUnit;
  distance_unit: DistanceUnit;
  base_currency: string;
  notification_prefs: NotificationPrefs;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  preDeparture: true,
  flightChanges: true,
  communityReplies: true,
  marketing: false,
};

const SELECT_COLUMNS = 'id, display_name, locale, temp_unit, distance_unit, base_currency, notification_prefs';

export async function getMyProfile(userId: string): Promise<ProfileRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select(SELECT_COLUMNS).eq('id', userId).single();
  if (error) throw error;
  return {
    ...(data as ProfileRow),
    notification_prefs: { ...DEFAULT_NOTIFICATION_PREFS, ...(data.notification_prefs ?? {}) },
  };
}

export type ProfilePatch = Partial<
  Pick<ProfileRow, 'locale' | 'temp_unit' | 'distance_unit' | 'base_currency' | 'notification_prefs'>
>;

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}
