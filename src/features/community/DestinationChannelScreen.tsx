import { PenLine, Search, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { useFxRates } from '@/features/plan/useFxRates';
import { getRate } from '@/features/plan/fxRates';
import { useSession } from '@/shared/hooks/useSession';
import { showToast } from '@/shared/ui/toast';
import { trackScreenView } from '@/shared/monitoring';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ChannelCompanionCard } from './channel/ChannelCompanionCard';
import { ChannelHeader } from './channel/ChannelHeader';
import { ChannelPinnedCard } from './channel/ChannelPinnedCard';
import { ChannelPostCard } from './channel/ChannelPostCard';
import {
  FxAndPricesCard,
  PopularTagsCard,
  TripCard,
  UrgentCompanionsCard,
} from './channel/ChannelSidebar';
import { CATEGORY_ICONS } from './categoryIcons';
import type { PostCategory } from './postMeta';
import { useFollowedDestinationIds, useToggleFollow } from './hooks/useCommunitySafety';
import {
  useChannelCompanions,
  useChannelPosts,
  useCurrentWeather,
  useDestinationFollowerCount,
  useDestinationGuide,
  usePinnedPost,
  usePopularTags,
  useUrgentCompanions,
} from './hooks/useDestinationChannel';
import { useDestination } from './hooks/useDestinations';
import type { PostSort } from './communityService';
import type { CompanionSort } from './companionService';
import styles from './DestinationChannelScreen.module.css';

/** 탭 순서는 시안: 전체 → 여행기 → Q&A → 동행 → 꿀팁 → 맛집 */
type ChannelTab = 'all' | PostCategory | 'companion';
const TABS: ChannelTab[] = ['all', 'story', 'qna', 'companion', 'tips', 'food'];

/** 검색 입력을 이만큼 멈췄다가 조회한다 */
const SEARCH_DEBOUNCE_MS = 350;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * 도시 채널 (/community/d/:slug) — 머리말(브레드크럼·이름·환율·날씨·팔로워·대표 명소) + 분류 탭·검색·정렬 + 글/동행 목록
 * + 사이드 카드(일정 만들기·환율 계산기·물가 예시·급구 동행). 모바일은 1열(머리말 → 탭 → 목록 → 사이드 카드).
 */
export function DestinationChannelScreen() {
  const { slug } = useParams<{ slug: string }>();
  // 다른 도시로 옮겨 가면 탭·검색·정렬이 처음 상태로 돌아가도록 도시마다 새로 그린다
  return <DestinationChannel key={slug} slug={slug} />;
}

function DestinationChannel({ slug }: { slug: string | undefined }) {
  const { t } = useTranslation(['community', 'common']);
  const navigate = useNavigate();
  const { user } = useSession();
  const requireLogin = useRequireLogin();
  const viewerId = user?.id ?? null;
  const { data: destination, isLoading, isError, refetch } = useDestination(slug);
  const { data: followedIds } = useFollowedDestinationIds(viewerId);
  const toggleFollow = useToggleFollow(viewerId);
  const { data: guide } = useDestinationGuide(destination?.id);
  const { data: followerCount } = useDestinationFollowerCount(destination?.id);
  const { data: weather } = useCurrentWeather(destination?.lat, destination?.lng);
  const { data: fxRates } = useFxRates();
  const { data: urgent } = useUrgentCompanions(destination?.id);
  const { data: pinned } = usePinnedPost(destination?.id, viewerId);
  const { data: popularTags } = usePopularTags(destination?.id);

  const [tab, setTab] = useState<ChannelTab>('all');
  const [draft, setDraft] = useState('');
  const [tag, setTag] = useState('');
  const [postSort, setPostSort] = useState<PostSort>('latest');
  const [companionSort, setCompanionSort] = useState<CompanionSort>('latest');
  const search = useDebounced(draft.trim(), SEARCH_DEBOUNCE_MS);
  const feedTop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackScreenView('community_destination');
  }, []);

  const posts = useChannelPosts({
    destinationId: destination?.id,
    viewerId,
    search,
    sort: postSort,
    category: tab === 'all' || tab === 'companion' ? undefined : tab,
    tag: tag || undefined,
  });
  const companions = useChannelCompanions({
    destinationId: destination?.id,
    viewerId,
    search,
    sort: companionSort,
  });
  const isCompanionTab = tab === 'companion';
  const feed = isCompanionTab ? companions : posts;
  const isFollowing = !!destination && (followedIds ?? []).includes(destination.id);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Skeleton height="160px" />
      </div>
    );
  }
  if (isError || !destination) {
    return <ErrorState summary={t('destination.loadError')} onRetry={() => refetch()} />;
  }

  const city = destination.name;
  const rateToKrw =
    destination.currency && destination.currency !== 'KRW'
      ? getRate(fxRates, destination.currency, 'KRW')
      : null;
  const writeHref = isCompanionTab
    ? `/community/companion/new?destination=${destination.slug}`
    : `/community/compose?destination=${destination.slug}`;

  function createTrip() {
    // 새 여행 만들기는 로그인해야 한다. 여행 만들기 창은 영문 도시명으로 장소를 찾는다
    if (!requireLogin()) return;
    const placeId = destination!.google_place_id;
    navigate(`/plan?autoCreate=${encodeURIComponent(destination!.nameEn ?? destination!.name)}${placeId ? `&placeId=${encodeURIComponent(placeId)}` : ''}`);
  }

  function onToggleFollow() {
    if (!destination) return;
    toggleFollow.mutate(
      { destinationId: destination.id, following: isFollowing },
      { onError: () => showToast(t('channel.followFailed'), { tone: 'error' }) },
    );
  }

  function searchLandmark(name: string) {
    setTab('all');
    setTag('');
    setDraft(name);
    feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** 태그(카드·인기 태그)를 누르면 그 태그가 달린 글만 — 동행 탭이었으면 전체 탭으로 */
  function filterByTag(name: string) {
    if (isCompanionTab) setTab('all');
    setDraft('');
    setTag(name);
    feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const sortValue = isCompanionTab ? companionSort : postSort;
  const sortOptions = isCompanionTab
    ? (['latest', 'deadline'] as const)
    : (['latest', 'popular', 'comments'] as const);
  const filterText = search || (tag ? `#${tag}` : '');
  const postItems = posts.data?.pages.flatMap((p) => p.posts) ?? [];
  const companionItems = companions.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        {destination.cover_url ? (
          <div
            className={styles.heroCover}
            style={{ backgroundImage: `url("${destination.cover_url}")` }}
            aria-hidden="true"
            data-testid="channel-cover"
          />
        ) : null}
        <div className={styles.container}>
          <ChannelHeader
            destination={destination}
            landmarks={guide?.landmarks ?? []}
            fxRates={fxRates}
            weather={weather}
            followerCount={followerCount}
            isFollowing={isFollowing}
            followDisabled={!user}
            followPending={toggleFollow.isPending}
            onToggleFollow={onToggleFollow}
            onCreateTrip={createTrip}
            onLandmarkClick={searchLandmark}
          />
        </div>
      </div>

      <div className={`${styles.container} ${styles.body}`}>
        <div ref={feedTop} className={styles.toolbar}>
          <div className={styles.tabs} role="group" aria-label={t('channel.tabs')}>
            {TABS.map((key) => {
              const Icon = key === 'all' ? null : key === 'companion' ? Users : CATEGORY_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  className={tab === key ? styles.tabOn : styles.tab}
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                >
                  {Icon ? <Icon size={16} aria-hidden="true" /> : null}
                  {key === 'all'
                    ? t('channel.tabAll')
                    : key === 'companion'
                      ? t('channel.tabCompanion')
                      : t(`postCategory.${key}`)}
                </button>
              );
            })}
          </div>
          <div className={styles.tools}>
            <label className={styles.search}>
              <Search size={18} aria-hidden="true" className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                value={draft}
                placeholder={t('channel.searchPlaceholder', { city })}
                aria-label={t('channel.searchAria', { city })}
                onChange={(e) => setDraft(e.target.value)}
              />
              {draft ? (
                <button
                  type="button"
                  className={styles.searchClear}
                  aria-label={t('channel.searchClear')}
                  onClick={() => setDraft('')}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <select
              className={styles.sort}
              value={sortValue}
              aria-label={t('channel.sortAria')}
              onChange={(e) =>
                isCompanionTab
                  ? setCompanionSort(e.target.value as CompanionSort)
                  : setPostSort(e.target.value as PostSort)
              }
            >
              {sortOptions.map((key) => (
                <option key={key} value={key}>
                  {t(`channel.sort.${key}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.columns}>
          <main className={styles.feed}>
            {pinned ? <ChannelPinnedCard post={pinned} onTagClick={filterByTag} /> : null}
            {tag && !isCompanionTab ? (
              <div className={styles.tagFilter} role="status">
                <span>{t('channel.tagFilter', { tag })}</span>
                <button type="button" className={styles.tagFilterClear} onClick={() => setTag('')}>
                  {t('channel.tagFilterClear')}
                </button>
              </div>
            ) : null}
            {feed.isLoading ? (
              <>
                <Skeleton height="140px" />
                <Skeleton height="140px" />
              </>
            ) : feed.isError ? (
              <ErrorState summary={t('feed.loadError')} onRetry={() => feed.refetch()} />
            ) : (isCompanionTab ? companionItems : postItems).length === 0 ? (
              <div className={styles.empty}>
                <h3>
                  {filterText && !isCompanionTab
                    ? t('channel.searchEmpty', { query: filterText })
                    : search
                      ? t('channel.searchEmpty', { query: search })
                      : isCompanionTab
                        ? t('channel.companionEmpty')
                        : t('destination.emptyPosts')}
                </h3>
                {(search && isCompanionTab) || (filterText && !isCompanionTab) ? (
                  <button
                    type="button"
                    className={styles.emptyCta}
                    onClick={() => {
                      setDraft('');
                      setTag('');
                    }}
                  >
                    {t('channel.searchClear')}
                  </button>
                ) : (
                  <>
                    {isCompanionTab ? null : <p>{t('feed.emptySub')}</p>}
                    <Link to={writeHref} className={styles.emptyCta} onClick={requireLogin}>
                      {isCompanionTab ? t('channel.companionWrite') : t('feed.writeFirst')}
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <>
                {isCompanionTab
                  ? companionItems.map((post) => <ChannelCompanionCard key={post.id} post={post} />)
                  : postItems.map((post) => (
                      <ChannelPostCard key={post.id} post={post} onTagClick={filterByTag} />
                    ))}
                {feed.hasNextPage ? (
                  <div className={styles.loadMoreWrap}>
                    <button
                      type="button"
                      className={styles.loadMore}
                      onClick={() => feed.fetchNextPage()}
                      disabled={feed.isFetchingNextPage}
                    >
                      {feed.isFetchingNextPage
                        ? t('state.loading', { ns: 'common' })
                        : t(isCompanionTab ? 'channel.loadMoreCompanion' : 'channel.loadMore', {
                            city,
                          })}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </main>

          <aside className={styles.side}>
            <TripCard
              city={city}
              timezone={destination.timezone}
              guide={guide}
              onCreateTrip={createTrip}
            />
            {destination.currency ? (
              <FxAndPricesCard
                currency={destination.currency}
                rateToKrw={rateToKrw}
                guide={guide}
              />
            ) : null}
            <UrgentCompanionsCard posts={urgent ?? []} />
            <PopularTagsCard city={city} tags={popularTags ?? []} onTagClick={filterByTag} />
          </aside>
        </div>
      </div>

      <Link to={writeHref} className={styles.fab} onClick={requireLogin}>
        <PenLine size={20} aria-hidden="true" />
        <span>{isCompanionTab ? t('channel.companionWrite') : t('channel.write')}</span>
      </Link>
    </div>
  );
}
