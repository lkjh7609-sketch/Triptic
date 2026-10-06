import './CommunityDesign.css';

import { useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNowStrict } from 'date-fns';
import { Heart, MessageCircle, PenLine, Search, Lightbulb, BookOpen, ArrowRight, ChevronDown, Lock, Users } from 'lucide-react';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { useSession } from '@/shared/hooks/useSession';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { DestinationSelector } from './DestinationSelector';
import { TravelAlertSummary } from '@/features/travelAlerts/TravelAlertSummary';
import { CompanionFeedList, CompanionFeedCard } from './CompanionFeedList';
import { useAllFeedItems } from './hooks/useAllFeedItems';
import { useToggleLike } from './hooks/usePosts';
import { AuthorName } from './AuthorName';
import { getPostImageUrl } from './imageProcessing';
import type { PostsPage } from './communityService';
import type { Destination, Post } from './types';
import type { Tab } from './CommunityScreen';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { postTitleOf } from './postMeta';
import tileStyles from './PostTile.module.css';
import { CATEGORY_ICONS } from './categoryIcons';

type Sort = 'latest' | 'likes' | 'comments';

interface Props {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleSearch: () => void;
  destinations?: Destination[];
  tab: Tab;
  setTab: (tab: Tab) => void;
  followedCount: number;
  feed: UseInfiniteQueryResult<InfiniteData<PostsPage>>;
  /** 동행 탭에서 고른 도시 — 도시 선택 줄은 세 탭이 같은 자리를 쓴다 */
  companionDestinationId?: string;
  setCompanionDestinationId: (id: string | undefined) => void;
  /** 동행 탭의 '내 동행모집' 버튼(자유게시판 자리) */
  hostingOnly: boolean;
  onToggleHosting: () => void;
}

function initialOf(name: string | null | undefined): string {
  return (name ?? '').trim().slice(0, 1).toUpperCase() || '?';
}

/**
 * 커뮤니티 데스크톱 (사용자 디자인). 글·작성자·좋아요·댓글 수·인기 여행지 등
 * 화면의 모든 내용은 실제 피드/여행지 데이터에서 온다. 데이터가 없으면 빈 상태를 보여준다.
 */
export function CommunityDesignBody({
  searchQuery,
  setSearchQuery,
  handleSearch,
  destinations,
  tab,
  setTab,
  followedCount,
  feed,
  companionDestinationId,
  setCompanionDestinationId,
  hostingOnly,
  onToggleHosting,
}: Props) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const requireLogin = useRequireLogin();
  const [sort, setSort] = useState<Sort>('latest');

  const posts = useMemo(() => {
    const list = feed.data?.pages.flatMap((p) => p.posts) ?? [];
    if (sort === 'likes') return [...list].sort((a, b) => b.like_count - a.like_count);
    if (sort === 'comments') return [...list].sort((a, b) => b.comment_count - a.comment_count);
    return list;
  }, [feed.data, sort]);
  // '전체' 탭(최신순)에는 모집 중인 동행 모집글도 시간순으로 섞는다
  const items = useAllFeedItems({
    posts,
    hasNextPage: !!feed.hasNextPage,
    viewerId: user?.id ?? null,
    enabled: tab === 'all' && sort === 'latest',
  });

  /** 불러온 글 기준으로 가장 활발한 작성자 */
  const activeAuthors = useMemo(() => {
    const counts = new Map<string, { post: Post; count: number }>();
    for (const post of feed.data?.pages.flatMap((p) => p.posts) ?? []) {
      const entry = counts.get(post.author_id);
      if (entry) entry.count += 1;
      else counts.set(post.author_id, { post, count: 1 });
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  }, [feed.data]);

  const popularDestinations = useMemo(
    () =>
      [...(destinations ?? [])]
        .sort((a, b) => b.post_count - a.post_count || a.sort_order - b.sort_order)
        .slice(0, 8),
    [destinations],
  );

  return (
    <div className="community-root bg-surface text-on-surface antialiased font-body-md text-body-md">
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-12 pt-10 pb-20">
        <section className="mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-surface-container-highest">
            <div>
              <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">{t('design.title')}</h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl">{t('design.subtitle')}</p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
              {user ? (
                <Link
                  to={`/community/user/${user.id}`}
                  className="inline-flex items-center justify-center gap-2 border border-outline-variant/40 hover:bg-surface-container-lowest text-on-surface px-5 py-3 rounded-full font-label-md text-label-md transition-all duration-200 shrink-0"
                >
                  <span>{t('feed.myPostsBtn')}</span>
                </Link>
              ) : null}
              <Link
                to="/community/compose"
                onClick={requireLogin}
                className="inline-flex items-center justify-center gap-2 bg-secondary hover:bg-secondary-container text-on-secondary px-5 py-3 rounded-full font-label-md text-label-md shadow-sm active:scale-95 transition-all duration-200 shrink-0"
              >
                <PenLine size={18} aria-hidden="true" />
                <span>{t('design.newPost')}</span>
              </Link>
              <Link
                to="/community/companion/new"
                onClick={requireLogin}
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-container text-on-primary px-5 py-3 rounded-full font-label-md text-label-md shadow-sm active:scale-95 transition-all duration-200 shrink-0"
              >
                <Users size={18} aria-hidden="true" />
                <span>{t('companion.list.writeBtn')}</span>
              </Link>
            </div>
          </div>

          <div className="mt-8 w-full">
            <DestinationSelector
              destinations={destinations || []}
              {...(tab === 'companion'
                ? {
                    selectedDestinationId: companionDestinationId,
                    onCitySelect: (city: Destination) => setCompanionDestinationId(city.id),
                    onClear: () => setCompanionDestinationId(undefined),
                    onToggleHosting,
                    hostingActive: hostingOnly,
                  }
                : {})}
              trailing={<TravelAlertSummary variant="button" />}
              searchElement={
                <div className="relative w-full shrink-0" style={{ maxWidth: '24rem', minWidth: '20rem' }}>
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-outline">
                    <Search size={20} aria-hidden="true" />
                  </div>
                  <input
                    className="w-full pl-10 pr-4 py-2.5 rounded-full bg-surface-container-lowest border border-outline-variant/40 focus:border-primary focus:ring-0 font-body-md text-body-md placeholder:text-outline text-primary transition-all shadow-[0_2px_8px_rgba(15,41,66,0.03)]"
                    placeholder={t('design.searchPlaceholder')}
                    aria-label={t('design.searchPlaceholder')}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              }
            />
          </div>

          <div className="mt-6 pt-4 flex items-center justify-between border-t border-surface-container-high text-body-md">
            <div className="flex items-center gap-6" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'all'}
                onClick={() => setTab('all')}
                className={
                  tab === 'all'
                    ? 'flex items-center gap-2 font-title-md text-title-md text-primary border-b-2 border-primary pb-2.5'
                    : 'flex items-center gap-2 font-label-md text-label-md text-on-surface-variant hover:text-primary pb-2.5 transition-colors'
                }
              >
                <span>{t('feed.tabAll')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'following'}
                onClick={() => setTab('following')}
                className={
                  tab === 'following'
                    ? 'flex items-center gap-2 font-title-md text-title-md text-primary border-b-2 border-primary pb-2.5'
                    : 'flex items-center gap-2 font-label-md text-label-md text-on-surface-variant hover:text-primary pb-2.5 transition-colors'
                }
              >
                <span>{t('feed.tabFollowing')}</span>
                {followedCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">
                    {followedCount}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'companion'}
                onClick={() => setTab('companion')}
                className={
                  tab === 'companion'
                    ? 'flex items-center gap-2 font-title-md text-title-md text-primary border-b-2 border-primary pb-2.5'
                    : 'flex items-center gap-2 font-label-md text-label-md text-on-surface-variant hover:text-primary pb-2.5 transition-colors'
                }
              >
                <span>{t('companion.list.tab')}</span>
              </button>
            </div>

            {tab !== 'companion' ? (
            <div className="flex items-center gap-2 font-label-md text-label-md text-on-surface-variant">
              <span className="text-outline">{t('design.sortBy')}</span>
              <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-full border border-outline-variant/30">
                {(['latest', 'likes', 'comments'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={sort === key}
                    onClick={() => setSort(key)}
                    className={
                      sort === key
                        ? 'px-3 py-1 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm shadow-xs font-semibold'
                        : 'px-3 py-1 rounded-full text-on-surface-variant hover:text-primary font-label-sm text-label-sm transition-colors'
                    }
                  >
                    {t(`design.sort.${key}`)}
                  </button>
                ))}
              </div>
            </div>
            ) : null}
          </div>
        </section>

        {tab === 'companion' ? (
          <CompanionFeedList destinationId={companionDestinationId} hostingOnly={hostingOnly} />
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 flex flex-col gap-6">
            {tab === 'following' && !user ? (
              <EmptyCard icon={<Lock size={20} />} title={t('feed.loginToFollow')} />
            ) : feed.isLoading ? (
              <>
                <Skeleton height="220px" />
                <Skeleton height="220px" />
              </>
            ) : feed.isError ? (
              <ErrorState summary={t('feed.loadError')} onRetry={() => feed.refetch()} />
            ) : items.length === 0 ? (
              <EmptyCard
                title={tab === 'following' ? t('feed.emptyFollowing') : t('feed.emptyAll')}
                description={t('feed.emptySub')}
                cta={
                  <Link
                    to="/community/compose"
                    onClick={requireLogin}
                    className="inline-flex items-center gap-2 font-label-md text-label-md text-secondary hover:text-primary transition-colors"
                  >
                    <span>{t('feed.writeFirst')}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                }
              />
            ) : (
              <>
                <div className={tileStyles.grid}>
                  {items.map((item) =>
                    item.kind === 'post' ? (
                      <PostArticle key={item.id} post={item.post} />
                    ) : (
                      <div key={item.id} style={{ gridColumn: '1 / -1' }}>
                        <CompanionFeedCard post={item.post} />
                      </div>
                    ),
                  )}
                </div>
                {feed.hasNextPage ? (
                  <div className="pt-6 pb-2 flex justify-center">
                    <button
                      type="button"
                      onClick={() => feed.fetchNextPage()}
                      disabled={feed.isFetchingNextPage}
                      className="px-8 py-3 rounded-full bg-surface-container-lowest border border-outline-variant/40 hover:border-primary text-primary font-label-md text-label-md transition-all duration-200 shadow-sm flex items-center gap-2"
                    >
                      <span>{feed.isFetchingNextPage ? t('common:state.loading') : t('feed.loadMore')}</span>
                      <ChevronDown size={18} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>

          <aside className="lg:col-span-4 flex flex-col gap-6 sticky top-24">
            <div className="bg-surface-container-low rounded-xl border border-outline-variant/40 p-6 relative overflow-hidden">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-bold flex items-center gap-1.5">
                  <Lightbulb size={16} aria-hidden="true" />
                  {t('design.promptLabel')}
                </span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-primary mb-2">{t('design.promptTitle')}</h3>
              <p className="font-body-md text-body-md text-on-surface-variant mb-4">{t('design.promptBody')}</p>
              <Link
                to="/community/compose"
                onClick={requireLogin}
                className="inline-flex items-center gap-2 font-label-md text-label-md text-secondary hover:text-primary transition-colors"
              >
                <span>{t('design.promptCta')}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            {activeAuthors.length > 0 ? (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 shadow-[0_4px_20px_-2px_rgba(15,41,66,0.03)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-title-md text-title-md text-primary">{t('design.activeAuthors')}</h3>
                </div>
                <div className="flex flex-col gap-4">
                  {activeAuthors.map(({ post, count }) => (
                    <div key={post.author_id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {post.author?.avatar_url ? (
                          <img
                            className="w-10 h-10 rounded-full object-cover border border-outline-variant/30"
                            src={post.author.avatar_url}
                            alt=""
                          />
                        ) : (
                          <span className="w-10 h-10 rounded-full border border-outline-variant/30 bg-surface-container flex items-center justify-center font-title-md text-primary">
                            {initialOf(post.author?.display_name)}
                          </span>
                        )}
                        <div>
                          <h4 className="font-title-md text-title-md text-primary text-sm leading-tight">
                            <AuthorName profile={post.author} />
                          </h4>
                          <p className="font-body-sm text-body-sm text-outline">{t('design.authorPosts', { count })}</p>
                        </div>
                      </div>
                      <Link
                        to={`/community/user/${post.author_id}`}
                        className="px-3 py-1 rounded-full border border-outline-variant/60 hover:border-primary text-primary font-label-sm text-label-sm transition-all hover:bg-surface-container"
                      >
                        {t('design.viewProfile')}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {popularDestinations.length > 0 ? (
              <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 shadow-[0_4px_20px_-2px_rgba(15,41,66,0.03)]">
                <h3 className="font-title-md text-title-md text-primary mb-3">{t('design.popularDestinations')}</h3>
                <div className="flex flex-wrap gap-2">
                  {popularDestinations.map((d) => (
                    <Link
                      key={d.id}
                      to={`/community/d/${d.slug}`}
                      className="px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm transition-colors"
                    >
                      {d.name}
                      {d.post_count > 0 ? <span className="text-outline ml-1">{d.post_count}</span> : null}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="p-5 rounded-xl border border-dashed border-outline-variant/50 bg-transparent flex flex-col gap-2">
              <div className="flex items-center gap-2 text-primary font-title-md text-sm">
                <BookOpen size={18} className="text-secondary" aria-hidden="true" />
                <span>{t('design.ethosTitle')}</span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{t('design.ethosBody')}</p>
              <a
                className="font-label-sm text-label-sm text-outline hover:text-primary transition-colors underline underline-offset-2 mt-1"
                href="/terms.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('design.guidelines')}
              </a>
            </div>
          </aside>
        </div>
        )}
      </main>
    </div>
  );
}

function EmptyCard({
  icon,
  title,
  description,
  cta,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-6 flex flex-col gap-2">
      {icon ? <span className="text-outline">{icon}</span> : null}
      <h2 className="font-headline-sm text-headline-sm text-primary leading-snug">{title}</h2>
      {description ? <p className="font-body-md text-body-md text-on-surface-variant">{description}</p> : null}
      {cta}
    </div>
  );
}

function PostArticle({ post }: { post: Post }) {
  const { t, i18n } = useTranslation('community');
  const { user } = useSession();
  const navigate = useNavigate();
  const toggleLike = useToggleLike(post.id, user?.id ?? null);
  const title = postTitleOf(post);
  const cover = post.images?.[0];
  const CategoryIcon = CATEGORY_ICONS[post.category];

  function handleLike(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || toggleLike.isPending) return;
    toggleLike.mutate(!!post.likedByMe);
  }

  function handleAuthor(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/community/user/${post.author_id}`);
  }

  // 작은 카드 — 사진(없으면 분류 아이콘 자리) · 도시·분류 칩 · 제목(최대 2줄) · 작성자·시간 · 숫자. 본문은 글을 열어야 보인다
  return (
    <Link to={`/community/post/${post.id}`} className={tileStyles.tile}>
      <div className={tileStyles.cover}>
        {cover ? (
          <img alt="" className={tileStyles.coverImg} loading="lazy" src={getPostImageUrl(cover.storage_path)} />
        ) : (
          <CategoryIcon size={30} className={tileStyles.coverIcon} aria-hidden="true" />
        )}
        {post.images && post.images.length > 1 ? <span className={tileStyles.photoCount}>+{post.images.length - 1}</span> : null}
      </div>

      <div className={tileStyles.body}>
        <div className={tileStyles.chips}>
          <span className={tileStyles.chip}>{post.destination?.name ?? t('board.free')}</span>
          {post.destination_id ? <span className={tileStyles.chipMuted}>{t(`postCategory.${post.category}`)}</span> : null}
        </div>
        <h2 className={tileStyles.title}>{title}</h2>

        <div className={tileStyles.foot}>
          <button type="button" className={tileStyles.authorBtn} onClick={handleAuthor}>
            <span className={tileStyles.authorName}>
              <AuthorName profile={post.author} />
            </span>
            <span className={tileStyles.time}>
              {formatDistanceToNowStrict(new Date(post.created_at), {
                addSuffix: true,
                locale: DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko,
              })}
            </span>
          </button>
          <div className={tileStyles.counts}>
            <button
              type="button"
              className={`${tileStyles.countBtn} ${post.likedByMe ? tileStyles.countOn : ''}`}
              onClick={handleLike}
              disabled={!user}
              aria-pressed={!!post.likedByMe}
              aria-label={t('post.likeAria', { count: post.like_count })}
            >
              <Heart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} aria-hidden="true" />
              <span>{post.like_count}</span>
            </button>
            <span className={tileStyles.count} aria-label={t('post.commentAria', { count: post.comment_count })}>
              <MessageCircle size={16} aria-hidden="true" />
              <span>{post.comment_count}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
