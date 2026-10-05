/** 동행 모집글의 "원하는 동행"(나이대·성별)과 태그 — DB(0070)에는 이 키 문자열로 저장하고, 화면 글은 번역 키로 만든다 */

/** 태그 선택 목록 — 이 순서대로 보여준다. 하나씩 추가하려면 DB 제약(companion_posts_tags_check)도 같이 고친다 */
export const COMPANION_TAGS = [
  'photo',
  'cafe',
  'night',
  'beer',
  'localfood',
  'healing',
  'tour',
  'shopping',
  'activity',
  'nature',
  'culture',
  'budget',
] as const;
export type CompanionTag = (typeof COMPANION_TAGS)[number];
export const MAX_COMPANION_TAGS = 3;

/** 나이대 — DB(0072)의 companion_posts_pref_ages_check와 같은 키 */
export const COMPANION_AGES = ['20s_early', '20s_late', '30s_early', '30s_late', '40s', '50s_plus'] as const;
export type CompanionAge = (typeof COMPANION_AGES)[number];

export type CompanionGender = 'any' | 'female' | 'male';
export const COMPANION_GENDERS: CompanionGender[] = ['any', 'female', 'male'];

export interface CompanionPrefs {
  ages: CompanionAge[];
  gender: CompanionGender;
  tags: CompanionTag[];
}

export const EMPTY_PREFS: CompanionPrefs = { ages: [], gender: 'any', tags: [] };

/** 알려진 키만 남기고 순서는 목록 순서로 — DB에서 온 값이 예상 밖이어도 화면이 깨지지 않게 */
export function sanitizeTags(tags: readonly string[] | null | undefined): CompanionTag[] {
  return COMPANION_TAGS.filter((tag) => tags?.includes(tag)).slice(0, MAX_COMPANION_TAGS);
}

export function sanitizeAges(ages: readonly string[] | null | undefined): CompanionAge[] {
  return COMPANION_AGES.filter((age) => ages?.includes(age));
}

/** 태그를 켜거나 끈다 — 이미 3개면 더 못 켠다 */
export function toggleTag(tags: CompanionTag[], tag: CompanionTag): CompanionTag[] {
  if (tags.includes(tag)) return tags.filter((t) => t !== tag);
  if (tags.length >= MAX_COMPANION_TAGS) return tags;
  return COMPANION_TAGS.filter((t) => t === tag || tags.includes(t));
}

export function toggleAge(ages: CompanionAge[], age: CompanionAge): CompanionAge[] {
  return COMPANION_AGES.filter((a) => (a === age ? !ages.includes(age) : ages.includes(a)));
}

/** 글에 원하는 조건이 하나라도 있는가(없으면 "무관"으로만 저장돼 있어 굳이 업데이트하지 않는다) */
export function hasPrefs(prefs: CompanionPrefs): boolean {
  return prefs.ages.length > 0 || prefs.gender !== 'any' || prefs.tags.length > 0;
}

/** 화면에 보여줄 "원하는 동행" 한 줄 — "20대 여성"·"20대·30대 무관". 조건이 없으면 빈 문자열 */
export function prefsLabel(
  post: { pref_ages?: string[]; pref_gender?: CompanionGender },
  t: (key: string) => string,
): string {
  const ages = sanitizeAges(post.pref_ages);
  const gender = post.pref_gender ?? 'any';
  const agesText = ages.map((a) => t(`companion.ages.${a}`)).join('·');
  const genderText = gender !== 'any' ? t(`companion.gender.${gender}`) : ages.length > 0 ? t('companion.gender.anyShort') : '';
  return [agesText, genderText].filter(Boolean).join(' ');
}

/** 남은 자리 수 — group_size는 글쓴이 본인을 포함한 인원이라 본인을 뺀다(최소 1) */
export function spotsLeft(post: { group_size: number }): number {
  return Math.max(1, post.group_size - 1);
}
