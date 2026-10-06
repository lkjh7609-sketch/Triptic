import { useMemo } from 'react';
import { useCompanionPostsFeed } from './useCompanionPosts';
import type { CompanionPost, Post } from '../types';

export type AllFeedItem =
  | { kind: 'post'; id: string; post: Post }
  | { kind: 'companion'; id: string; post: CompanionPost };

/**
 * '전체' 탭 — 일반 글에 모집 중인 동행 모집글을 시간순으로 섞는다.
 * 두 목록은 따로 커서 페이지네이션이라, 불러온 일반 글 중 가장 오래된 글보다 새로운 모집글만 끼워
 * 순서가 뒤집히지 않게 한다(일반 글이 더 없으면 불러온 모집글 전부).
 * 모집글 목록은 최신순(created_at 내림차순)이어야 한다.
 */
export function mergeAllFeed(posts: Post[], companions: CompanionPost[], hasNextPage: boolean): AllFeedItem[] {
  const items: AllFeedItem[] = posts.map((post) => ({ kind: 'post', id: post.id, post }));
  if (companions.length === 0) return items;
  const oldest = posts.length > 0 ? posts[posts.length - 1]!.created_at : null;
  const cutoff = hasNextPage && oldest ? oldest : null;
  for (const post of companions) {
    if (cutoff && post.created_at < cutoff) continue;
    items.push({ kind: 'companion', id: `c-${post.id}`, post });
  }
  const at = (item: AllFeedItem) => item.post.created_at;
  // 고정(pinned) 글은 원래 자리(맨 위)를 지키고, 나머지만 시간 내림차순으로 정렬한다
  const pinned = items.filter((i) => i.kind === 'post' && i.post.pinned_at);
  const rest = items.filter((i) => !(i.kind === 'post' && i.post.pinned_at));
  rest.sort((a, b) => (at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0));
  return [...pinned, ...rest];
}

/** 메인 커뮤니티 '전체' 탭용 — 모집 중인 모집글을 직접 불러와 섞는다 */
export function useAllFeedItems(opts: {
  posts: Post[];
  hasNextPage: boolean;
  viewerId: string | null;
  /** false면 모집글을 섞지 않는다(구독 탭·좋아요/댓글순 정렬 등) */
  enabled: boolean;
}): AllFeedItem[] {
  const companions = useCompanionPostsFeed({ viewerId: opts.viewerId });
  const companionList = useMemo(
    () => (opts.enabled ? (companions.data?.pages.flatMap((p) => p.posts) ?? []) : []),
    [companions.data, opts.enabled],
  );
  return useMemo(
    () => mergeAllFeed(opts.posts, companionList, opts.hasNextPage),
    [opts.posts, opts.hasNextPage, companionList],
  );
}
