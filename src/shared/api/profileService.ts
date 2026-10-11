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

/** 알림 묶음 — 커뮤니티(댓글·답글·좋아요) · 내 여행(출발 임박·여행경보) · 동행 · 공동 편집. 운영 조치 알림은 묶음 설정과 무관하게 항상 온다(0112) */
export interface NotificationPrefs {
  trip: boolean;
  community: boolean;
  companion: boolean;
  collab: boolean;
  /** 알림 전체 허용(설정 맨 위 토글). 없으면 켜진 것으로 본다. 끄면 서버가 운영 조치 알림까지 모두 만들지 않는다 — 묶음 설정은 그대로 둔다 */
  enabled?: boolean;
}

/** 알림 묶음 이름(전체 허용 `enabled`는 뺀 것) */
export type NotificationKey = Exclude<keyof NotificationPrefs, 'enabled'>;

export const NOTIFICATION_KEYS: NotificationKey[] = ['trip', 'community', 'companion', 'collab'];

/** 저장된 값(예전 키가 섞여 있을 수 있다)을 지금 묶음으로 — 모르는 키는 버리고, 없는 묶음은 켜진 것으로 */
export function normalizeNotificationPrefs(raw: unknown): NotificationPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const flag = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const prefs: NotificationPrefs = {
    trip: flag(r.trip, flag(r.preDeparture, true)),
    community: flag(r.community, flag(r.communityReplies, true)),
    companion: flag(r.companion, true),
    collab: flag(r.collab, true),
  };
  if (typeof r.enabled === 'boolean') prefs.enabled = r.enabled;
  return prefs;
}

/** 알림 전체 허용 여부 */
export function notificationsEnabled(prefs: NotificationPrefs): boolean {
  return prefs.enabled ?? true;
}

/** 알림 전체 허용을 바꾼 값 */
export function withNotificationsEnabled(prefs: NotificationPrefs, enabled: boolean): NotificationPrefs {
  return { ...prefs, enabled };
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
  /** 프로필 사진 — 직접 올린 사진(avatars 버킷, 0092)이 있으면 그 주소, 없으면 null(소셜 로그인 사진을 쓴다) */
  avatar_url: string | null;
  /** 통계 탭 도트 캐릭터를 정하는 값 — 없으면 사용자 ID로 만든다(0105). 설정에서 '랜덤으로 바꾸기'로 바꾼다 */
  pixel_avatar_seed: string | null;
  /** 지금까지 만든 여행 수(삭제해도 안 줄어듦)와 무료 여행 생성 한도(0061) — 프로는 한도를 쓰지 않는다 */
  trips_created_count: number;
  trip_limit: number;
}

const SELECT_COLUMNS = 'id, display_name, handle, plan, locale, temp_unit, distance_unit, base_currency, notification_prefs, gender, age_band, demographics_skips, avatar_url, pixel_avatar_seed, trips_created_count, trip_limit';

export async function getMyProfile(userId: string): Promise<ProfileRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('profiles').select(SELECT_COLUMNS).eq('id', userId).single();
  if (error) throw error;
  return {
    ...(data as ProfileRow),
    notification_prefs: normalizeNotificationPrefs(data.notification_prefs),
  };
}

export type ProfilePatch = Partial<
  Pick<ProfileRow, 'display_name' | 'locale' | 'temp_unit' | 'distance_unit' | 'base_currency' | 'notification_prefs' | 'gender' | 'age_band' | 'avatar_url' | 'pixel_avatar_seed'>
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
