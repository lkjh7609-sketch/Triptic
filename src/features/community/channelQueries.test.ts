import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ log: [] as [string, ...unknown[]][], table: '' }));

vi.mock('@/shared/api/supabaseClient', () => {
  // 끝에 await 되는 체인 — 모든 메서드를 기록하고 자기 자신을 돌려준다
  const chain: Record<string, unknown> = {};
  const methods = [
    'select',
    'eq',
    'is',
    'in',
    'order',
    'limit',
    'range',
    'or',
    'ilike',
    'gte',
    'contains',
    'not',
  ];
  for (const m of methods) {
    chain[m] = (...args: unknown[]) => {
      calls.log.push([m, ...args]);
      return chain;
    };
  }
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return {
    getSupabaseClient: () => ({
      from: (table: string) => ((calls.table = table), chain),
      rpc: (name: string, args: unknown) => {
        calls.log.push(['rpc', name, args]);
        return Promise.resolve({
          data: name === 'destination_popular_tags' ? [{ tag: '바투동굴', uses: '3' }] : null,
          error: null,
        });
      },
    }),
  };
});

import {
  escapeLike,
  getPinnedPost,
  listPopularTags,
  listPosts,
  recordPostView,
  setPostAcceptedComment,
  setPostPinned,
} from './communityService';
import { listCompanionPosts, listUrgentCompanionPosts } from './companionService';

const names = () => calls.log.map((c) => c[0]);
const find = (name: string) => calls.log.find((c) => c[0] === name);

beforeEach(() => {
  calls.log = [];
  calls.table = '';
});

describe('escapeLike', () => {
  it('와일드카드와 역슬래시를 문자 그대로 찾도록 막는다', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('c:\\x')).toBe('c:\\\\x');
    expect(escapeLike('바투 동굴')).toBe('바투 동굴');
  });
});

describe('listPosts — 도시 채널 검색·정렬', () => {
  it('최신순은 커서 방식(limit)이고 검색어는 제목·본문 ilike(or)로 간다', async () => {
    await listPosts({ destinationId: 'kl', search: ' 바투_동굴 ', sort: 'latest' });
    expect(calls.log.find((c) => c[0] === 'or')?.[1]).toBe('title.ilike."%바투\\\\_동굴%",body.ilike."%바투\\\\_동굴%"');
    expect(names()).toContain('limit');
    expect(names()).not.toContain('range');
    expect(calls.log.filter((c) => c[0] === 'order').map((c) => c[1])).toEqual([
      'created_at',
      'id',
    ]);
  });

  it('인기순은 좋아요 수 먼저, 댓글순은 댓글 수 먼저 정렬하고 위치(range)로 이어 받는다', async () => {
    await listPosts({ destinationId: 'kl', sort: 'popular', offset: 20, limit: 20 });
    expect(calls.log.filter((c) => c[0] === 'order').map((c) => c[1])).toEqual([
      'like_count',
      'created_at',
      'id',
    ]);
    expect(find('range')).toEqual(['range', 20, 39]);
    expect(names()).not.toContain('limit');

    calls.log = [];
    await listPosts({ destinationId: 'kl', sort: 'comments' });
    expect(calls.log.filter((c) => c[0] === 'order').map((c) => c[1])).toEqual([
      'comment_count',
      'created_at',
      'id',
    ]);
    expect(find('range')).toEqual(['range', 0, 19]);
  });

  it('검색어가 비어 있으면 ilike를 걸지 않는다', async () => {
    await listPosts({ destinationId: 'kl', search: '   ' });
    expect(names()).not.toContain('ilike');
  });
});

describe('listCompanionPosts — 도시 채널', () => {
  it('검색은 제목·내용을 따옴표로 묶어 or로 건다(쉼표·괄호가 필터 문법이 되지 않게)', async () => {
    await listCompanionPosts({ destinationId: 'kl', search: 'a,b)"c' });
    const or = calls.log.find((c) => c[0] === 'or' && String(c[1]).startsWith('title.ilike'));
    expect(or?.[1]).toBe('title.ilike."%a,b)\\"c%",body.ilike."%a,b)\\"c%"');
  });

  it('출발 임박순은 지난 출발을 빼고 출발일 순으로 위치 이어 받기', async () => {
    await listCompanionPosts({ destinationId: 'kl', sort: 'deadline', offset: 20 });
    expect(
      calls.log.some(
        (c) =>
          c[0] === 'or' &&
          String(c[1]).includes('start_date.gte.') &&
          String(c[1]).includes('start_date.is.null'),
      ),
    ).toBe(true);
    expect(calls.log.find((c) => c[0] === 'order')?.[1]).toBe('start_date');
    expect(find('range')).toEqual(['range', 20, 39]);
  });

  it('급구 동행은 이 도시의 모집 중·오늘 이후 출발만 가까운 순으로 2개', async () => {
    await listUrgentCompanionPosts('kl');
    expect(calls.table).toBe('companion_posts');
    expect(find('eq')).toEqual(['eq', 'status', 'recruiting']);
    expect(calls.log.some((c) => c[0] === 'eq' && c[1] === 'destination_id' && c[2] === 'kl')).toBe(
      true,
    );
    expect(calls.log.find((c) => c[0] === 'gte')?.[1]).toBe('start_date');
    expect(find('limit')).toEqual(['limit', 2]);
  });
});

describe('listPosts — 분류·태그·고정 글(0077)', () => {
  it('분류는 category 일치로, 태그는 tags 배열 포함으로(본문 검색 ilike와 별개) 건다', async () => {
    await listPosts({ destinationId: 'kl', category: 'qna', tag: '바투동굴' });
    expect(find('eq' as never)).toBeDefined();
    expect(calls.log.some((c) => c[0] === 'eq' && c[1] === 'category' && c[2] === 'qna')).toBe(
      true,
    );
    expect(calls.log.find((c) => c[0] === 'contains')).toEqual(['contains', 'tags', ['바투동굴']]);
    expect(names()).not.toContain('ilike');
  });

  it('hidePinned면 고정 글(pinned_at 있는 글)을 목록에서 뺀다', async () => {
    await listPosts({ destinationId: 'kl', hidePinned: true });
    expect(calls.log.some((c) => c[0] === 'is' && c[1] === 'pinned_at' && c[2] === null)).toBe(
      true,
    );
    calls.log = [];
    await listPosts({ destinationId: 'kl' });
    expect(calls.log.some((c) => c[0] === 'is' && c[1] === 'pinned_at')).toBe(false);
  });

  it('고정 글 조회는 이 도시의 공개 글 중 pinned_at이 있는 하나', async () => {
    expect(await getPinnedPost('kl', null)).toBeNull();
    expect(calls.log.some((c) => c[0] === 'eq' && c[1] === 'destination_id' && c[2] === 'kl')).toBe(
      true,
    );
    expect(calls.log.find((c) => c[0] === 'not')).toEqual(['not', 'pinned_at', 'is', null]);
  });
});

describe('서버 함수 호출 — 조회수·고정·채택·인기 태그', () => {
  it('각각 알맞은 함수와 인자로 부른다', async () => {
    await recordPostView('p1');
    await setPostPinned('p1', true);
    await setPostAcceptedComment('p1', 'c1');
    await setPostAcceptedComment('p1', null);
    expect(calls.log.filter((c) => c[0] === 'rpc')).toEqual([
      ['rpc', 'record_post_view', { p_post_id: 'p1' }],
      ['rpc', 'set_post_pinned', { p_post_id: 'p1', p_pinned: true }],
      ['rpc', 'set_post_accepted_comment', { p_post_id: 'p1', p_comment_id: 'c1' }],
      ['rpc', 'set_post_accepted_comment', { p_post_id: 'p1', p_comment_id: null }],
    ]);
  });

  it('인기 태그의 횟수는 숫자로 바꿔 돌려준다(bigint가 문자열로 온다)', async () => {
    expect(await listPopularTags('kl', 6)).toEqual([{ tag: '바투동굴', uses: 3 }]);
    expect(calls.log.find((c) => c[0] === 'rpc')).toEqual([
      'rpc',
      'destination_popular_tags',
      { p_destination_id: 'kl', p_limit: 6 },
    ]);
  });
});
