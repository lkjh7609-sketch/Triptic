import { describe, expect, it } from 'vitest';
import { mergeAllFeed } from './useAllFeedItems';
import type { CompanionPost, Post } from '../types';

const post = (id: string, created_at: string, pinned_at: string | null = null) =>
  ({ id, created_at, pinned_at }) as unknown as Post;
const comp = (id: string, created_at: string) => ({ id, created_at }) as unknown as CompanionPost;

describe('mergeAllFeed', () => {
  it('일반 글과 모집글을 최신순으로 섞는다', () => {
    const out = mergeAllFeed([post('p1', '2026-10-05'), post('p2', '2026-10-01')], [comp('c1', '2026-10-03')], false);
    expect(out.map((i) => i.id)).toEqual(['p1', 'c-c1', 'p2']);
  });

  it('일반 글이 더 남았으면 불러온 가장 오래된 글보다 오래된 모집글은 뺀다', () => {
    const out = mergeAllFeed([post('p1', '2026-10-05')], [comp('c1', '2026-10-06'), comp('c2', '2026-10-01')], true);
    expect(out.map((i) => i.id)).toEqual(['c-c1', 'p1']);
  });

  it('고정 글은 맨 위를 지킨다', () => {
    const out = mergeAllFeed([post('p1', '2026-10-01', '2026-10-01')], [comp('c1', '2026-10-06')], false);
    expect(out.map((i) => i.id)).toEqual(['p1', 'c-c1']);
  });
});
