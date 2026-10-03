/** 글 분류(0077) — 올린 뒤에는 바꿀 수 없다. 탭 순서는 시안(전체 → 여행기 → Q&A → 동행 → 꿀팁 → 맛집)을 따른다 */
export const POST_CATEGORIES = ['story', 'qna', 'tips', 'food'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

export function isPostCategory(value: unknown): value is PostCategory {
  return typeof value === 'string' && (POST_CATEGORIES as readonly string[]).includes(value);
}

export const MAX_TAGS = 3;
export const MAX_TAG_LENGTH = 20;

/**
 * 태그 한 개를 다듬는다 — 앞뒤 공백과 앞의 #을 떼고, 안의 연속 공백은 하나로. 비었거나 20자를 넘으면 null.
 * 서버(create_moderated_post)도 같은 규칙으로 한 번 더 정리한다.
 */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim();
  if (!tag || [...tag].length > MAX_TAG_LENGTH) return null;
  return tag;
}

/** 태그 목록 — 다듬고, 중복(대소문자 무시)은 처음 것만, 3개까지 */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of raw) {
    const tag = normalizeTag(item);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
}
