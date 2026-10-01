import { describe, expect, it } from 'vitest';
import { COMPANION_TAGS, EMPTY_PREFS, MAX_COMPANION_TAGS, hasPrefs, sanitizeAges, sanitizeTags, toggleAge, toggleTag } from './companionPrefs';

describe('companionPrefs', () => {
  it('태그 목록 순서: 사진촬영·카페투어·야경투어·맥주한잔·로컬맛집 …', () => {
    expect(COMPANION_TAGS.slice(0, 5)).toEqual(['photo', 'cafe', 'night', 'beer', 'localfood']);
    expect(COMPANION_TAGS).toHaveLength(12);
  });

  it('태그는 3개까지만 켜지고, 켠 것은 끌 수 있고, 항상 목록 순서로 정렬된다', () => {
    let tags = toggleTag([], 'beer');
    tags = toggleTag(tags, 'photo');
    tags = toggleTag(tags, 'budget');
    expect(tags).toEqual(['photo', 'beer', 'budget']);
    expect(toggleTag(tags, 'cafe')).toEqual(tags); // 4번째는 무시
    expect(tags).toHaveLength(MAX_COMPANION_TAGS);
    expect(toggleTag(tags, 'beer')).toEqual(['photo', 'budget']);
  });

  it('나이대는 여러 개를 고를 수 있다', () => {
    expect(toggleAge(toggleAge([], '30s_early'), '20s_late')).toEqual(['20s_late', '30s_early']);
    expect(toggleAge(['20s_late', '30s_early'], '20s_late')).toEqual(['30s_early']);
  });

  it('DB에서 온 예상 밖 값은 걸러낸다', () => {
    expect(sanitizeTags(['beer', 'unknown', 'photo'])).toEqual(['photo', 'beer']);
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeAges(['20s', '40s', 'x'])).toEqual(['40s']);
  });

  it('조건이 없으면 hasPrefs는 false', () => {
    expect(hasPrefs(EMPTY_PREFS)).toBe(false);
    expect(hasPrefs({ ...EMPTY_PREFS, gender: 'female' })).toBe(true);
  });
});
