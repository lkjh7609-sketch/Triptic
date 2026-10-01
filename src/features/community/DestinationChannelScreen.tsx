import { PenLine, Search, X } from 'lucide-react';
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
import { ChannelPostCard } from './channel/ChannelPostCard';
import { FxAndPricesCard, TripCard, UrgentCompanionsCard } from './channel/ChannelSidebar';
import { useFollowedDestinationIds, useToggleFollow } from './hooks/useCommunitySafety';
import {
  useChannelCompanions,
  useChannelPosts,
  useCurrentWeather,
  useDestinationFollowerCount,
  useDestinationGuide,
  useUrgentCompanions,
} from './hooks/useDestinationChannel';
import { useDestination } from './hooks/useDestinations';
import type { PostSort } from './communityService';
import type { CompanionSort } from './companionService';
import styles from './DestinationChannelScreen.module.css';

type ChannelTab = 'all' | 'companion';

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

  const [tab, setTab] = useState<ChannelTab>('all');
  const [draft, setDraft] = useState('');
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
  });
  const companions = useChannelCompanions({
    destinationId: destination?.id,
    viewerId,
    search,
    sort: companionSort,
  });
  const feed = tab === 'all' ? posts : companions;
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
  const writeHref =
    tab === 'companion'
      ? '/community/companion/new'
      : `/community/compose?destination=${destination.slug}`;

  function createTrip() {
    // 새 여행 만들기는 로그인해야 한다. 여행 만들기 창은 영문 도시명으로 장소를 찾는다
    if (!requireLogin()) return;
    navigate(`/plan?autoCreate=${encodeURIComponent(destination!.nameEn ?? destination!.name)}`);
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
    setDraft(name);
    feedTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const sortValue = tab === 'all' ? postSort : companionSort;
  const sortOptions =
    tab === 'all'
      ? (['latest', 'popular', 'comments'] as const)
      : (['latest', 'deadline'] as const);
  const postItems = posts.data?.pages.flatMap((p) => p.posts) ?? [];
  const companionItems = companions.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
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
            <button
              type="button"
              className={tab === 'all' ? styles.tabOn : styles.tab}
              aria-pressed={tab === 'all'}
              onClick={() => setTab('all')}
            >
              {t('channel.tabAll')}
            </button>
            <button
              type="button"
              className={tab === 'companion' ? styles.tabOn : styles.tab}
              aria-pressed={tab === 'companion'}
              onClick={() => setTab('companion')}
            >
              {t('channel.tabCompanion')}
            </button>
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
                tab === 'all'
                  ? setPostSort(e.target.value as PostSort)
                  : setCompanionSort(e.target.value as CompanionSort)
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
            {feed.isLoading ? (
              <>
                <Skeleton height="140px" />
                <Skeleton height="140px" />
              </>
            ) : feed.isError ? (
              <ErrorState summary={t('feed.loadError')} onRetry={() => feed.refetch()} />
            ) : (tab === 'all' ? postItems : companionItems).length === 0 ? (
              <div className={styles.empty}>
                <h3>
                  {search
                    ? t('channel.searchEmpty', { query: search })
                    : tab === 'companion'
                      ? t('channel.companionEmpty')
                      : t('destination.emptyPosts')}
                </h3>
                {search ? (
                  <button type="button" className={styles.emptyCta} onClick={() => setDraft('')}>
                    {t('channel.searchClear')}
                  </button>
                ) : (
                  <>
                    {tab === 'all' ? <p>{t('feed.emptySub')}</p> : null}
                    <Link to={writeHref} className={styles.emptyCta} onClick={requireLogin}>
                      {tab === 'companion' ? t('channel.companionWrite') : t('feed.writeFirst')}
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <>
                {tab === 'all'
                  ? postItems.map((post) => <ChannelPostCard key={post.id} post={post} />)
                  : companionItems.map((post) => (
                      <ChannelCompanionCard key={post.id} post={post} />
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
                        : t(tab === 'all' ? 'channel.loadMore' : 'channel.loadMoreCompanion', {
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
          </aside>
        </div>
      </div>

      <Link to={writeHref} className={styles.fab} onClick={requireLogin}>
        <PenLine size={20} aria-hidden="true" />
        <span>{tab === 'companion' ? t('channel.companionWrite') : t('channel.write')}</span>
      </Link>
    </div>
  );
}
