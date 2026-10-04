/**
 * 사용자 프로필 조회/수정 (02-screens.md §5 환경설정/알림 섹션)
 * profiles 테이블은 legacy(2.x)부터 이미 존재하고 own-row RLS(select/insert/update,
 * auth.uid() = id)가 적용돼 있다 — 이 서비스는 그 위에 얇게 얹는다.
 */
import { getSupabaseClient } from './supabaseClient';

export type Locale = 'ko' | 'en' | 'zh-TW' | 'ja';
export type TempUnit = 'c' | 'f';
export type DistanceUnit = 'km' | 'mi';

export type MemberGender = 'female' | 'male';
export type MemberAgeBand = '20s_early' | '20s_late' | '30s_early' | '30s_late' | '40s' | '50s_plus';

export interface NotificationPrefs {
  preDeparture: boolean;
  flightChanges: boolean;
  communityReplies: boolean;
  marketing: boolean;
}

export interface ProfileRow {
  id: string;
  display_name: string;
  /** 가입 시 서버가 발급하는 닉네임과 무관한 5자리 식별자 — 본인만 확인 가능(0041) */
  handle: string | null;
  /** 요금제 — 관리자가 수동으로 정한다(0037). 'pro'면 프로 배지 */
  plan: 'free' | 'pro';
  locale: Locale;
  temp_unit: TempUnit;
  distance_unit: DistanceUnit;
  base_currency: string;
  notification_prefs: NotificationPrefs;
  /** 선택 입력 — 동행 모집·지원 화면에 나잇대·성별로 보여 준다(0088) */
  gender: MemberGender | null;
  age_band: MemberAgeBand | null;
  /** '나중에'를 누른 횟수 — 서버가 센다. 2번이면 더 묻지 않는다 */
  demographics_skips: number;
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  preDeparture: true,
  flightChanges: true,
  communityReplies: true,
  marketing: false,
};

const SELECT_COLUMNS = 'id, display_name, handle, plan, locale, temp_unit, distance_unit, base_currency, notification_prefs, gender, age_band, demographics_skips';

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
  Pick<ProfileRow, 'display_name' | 'locale' | 'temp_unit' | 'distance_unit' | 'base_currency' | 'notification_prefs' | 'gender' | 'age_band'>
>;

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

/** 닉네임 중복확인(저장 전 미리 물어보기 — 실제 경계는 서버 트리거, 0041) */
export async function checkDisplayNameAvailable(name: string, excludeId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('is_display_name_available', { p_name: name, p_exclude_id: excludeId });
  if (error) throw error;
  return data as boolean;
}

/** "나중에" — 서버가 횟수를 센다(이용자가 직접 못 바꾸는 컬럼) */
export async function skipMyDemographics(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('skip_my_demographics');
  if (error) throw error;
}
