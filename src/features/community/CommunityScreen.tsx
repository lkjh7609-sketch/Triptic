import { Lock as LockIcon, PenLine, Users, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { usePostsFeed } from './hooks/usePosts';
import { useDestinations } from './hooks/useDestinations';
import { useFollowedDestinationIds } from './hooks/useCommunitySafety';
import { PostCard } from './PostCard';
import { DestinationSelector } from './DestinationSelector';
import { TravelAlertSummary } from '@/features/travelAlerts/TravelAlertSummary';
import { CompanionFeedList } from './CompanionFeedList';
import { PendingCompanionReviewPrompt } from './PendingCompanionReviewPrompt';
import styles from './CommunityScreen.module.css';
import { CommunityDesignBody } from './CommunityDesign';
import { useRequireLogin } from '@/features/auth/loginPrompt';

export type Tab = 'all' | 'following' | 'companion';

export function CommunityScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const requireLogin = useRequireLogin();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  // 홈의 "같이 갈 사람 찾기 > 더보기"는 ?tab=companion 으로 들어온다
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (searchParams.get('tab') === 'companion' ? 'companion' : 'all'));
  const { data: destinations } = useDestinations();
  const { data: followedIds } = useFollowedDestinationIds(user?.id ?? null);

  const feed = usePostsFeed({ tab: tab === 'following' ? 'following' : 'all', viewerId: user?.id ?? null });
  const [searchQuery, setSearchQuery] = useState('');
  // 동행 탭에서 고른 도시(그 도시 모집글만 보여 준다) — 선택 버튼은 전체·구독 탭과 같은 자리에 둔다
  const [companionDestinationId, setCompanionDestinationId] = useState<string | undefined>(undefined);
  const navigate = useNavigate();
  const handleSearch = () => {
    if (!searchQuery) return;
    const dest = destinations?.find(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.slug.toLowerCase().includes(searchQuery.toLowerCase()));
    if (dest) {
      navigate(`/community/d/${dest.slug}`);
    } else {
      alert(t('feed.searchError'));
    }
  };


  useEffect(() => {
    trackScreenView('community_feed');
  }, []);

  const followedDestinations = (destinations ?? []).filter((d) => (followedIds ?? []).includes(d.id));
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  if (isDesktop) {
    return (
      <div className={styles.desktopWrap} style={{ padding: 0 }}>
        {user ? <PendingCompanionReviewPrompt userId={user.id} /> : null}
        <CommunityDesignBody
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearch={handleSearch}
          destinations={destinations}
          tab={tab}
          setTab={setTab}
          followedCount={followedDestinations.length}
          feed={feed}
          companionDestinationId={companionDestinationId}
          setCompanionDestinationId={setCompanionDestinationId}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${styles.desktopWrap}`}>
      {user ? <PendingCompanionReviewPrompt userId={user.id} /> : null}
      {user ? (
        <div className={styles.composeBtnRow}>
          <Link to="/community/compose" className={styles.fabBtnDesktop}>
            <PenLine size={20} /> <span>{t('feed.writeBtn')}</span>
          </Link>
          <Link to="/community/companion/new" className={styles.fabBtnDesktop}>
            <Users size={20} /> <span>{t('companion.list.writeBtn')}</span>
          </Link>
        </div>
      ) : null}

      <div className={styles.headerSection}>
        <div>
          <div className={styles.subtitle}>{t('feed.subtitle')}</div>
          <h1 className={styles.mainTitle}>{t('feed.title')}</h1>
        </div>
        {user ? (
          <Link to={`/community/user/${user.id}`} className={styles.myPostsLink}>
            {t('feed.myPostsBtn')}
          </Link>
        ) : null}
      </div>

      <div className={styles.filterSection}>
        <div className={styles.searchBarWrap}>
          <input 
            type="text" 
            className={styles.searchInput} 
            placeholder={t('feed.searchPlaceholder')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <div className={styles.tabsDesktop}>
          <button
            type="button"
            className={tab === 'all' ? styles.tabActive : styles.tab}
            onClick={() => setTab('all')}
          >
            {t('feed.tabAll')}
          </button>
          <button
            type="button"
            className={tab === 'following' ? styles.tabActive : styles.tab}
            onClick={() => setTab('following')}
          >
            {t('feed.tabFollowing')}
          </button>
          <button
            type="button"
            className={tab === 'companion' ? styles.tabActive : styles.tab}
            onClick={() => setTab('companion')}
          >
            {t('companion.list.tab')}
          </button>
        </div>

        {destinations && destinations.length > 0 ? (
          <div className={styles.selectorGutter}>
            {tab === 'companion' ? (
              <DestinationSelector
                destinations={destinations}
                selectedDestinationId={companionDestinationId}
                onCitySelect={(city) => setCompanionDestinationId(city.id)}
                onClear={() => setCompanionDestinationId(undefined)}
              />
            ) : (
              <DestinationSelector destinations={destinations} />
            )}
          </div>
        ) : null}

        {tab !== 'companion' ? (
          <div className={styles.selectorGutter}>
            <TravelAlertSummary />
          </div>
        ) : null}

        {tab !== 'companion' && followedDestinations.length > 0 ? (
          <div className={styles.chipRow}>
            {followedDestinations.map((d) => (
              <Link key={d.id} to={`/community/d/${d.slug}`} className={styles.chip}>
                {d.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {tab === 'companion' ? (
        <CompanionFeedList destinationId={companionDestinationId} />
      ) : tab === 'following' && !user ? (
        <EmptyState icon={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><LockIcon size={16} /></span>} message={t('feed.loginToFollow')} />
      ) : feed.isLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton height="80px" />
          <div style={{ height: 12 }} />
          <Skeleton height="80px" />
        </div>
      ) : feed.isError ? (
        <ErrorState summary={t('feed.loadError')} onRetry={() => feed.refetch()} />
      ) : posts.length === 0 ? (
        <div className={styles.emptyGrid}>
          <div className={styles.emptyMainCard}>
            <span className={styles.emptyIcon} aria-hidden="true">
              <MessageCircle size={24} />
            </span>
            <h3>{tab === 'following' ? t('feed.emptyFollowing') : t('feed.emptyAll')}</h3>
            <p>{t('feed.emptySub')}</p>
            <Link to="/community/compose" className={styles.emptyCta} onClick={requireLogin}>{t('feed.writeFirst')}</Link>
          </div>
          
        </div>
      ) : (
        <>
          <div className={styles.desktopList}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          {feed.hasNextPage ? (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                className={styles.loadMoreBtn}
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
              >
                {feed.isFetchingNextPage ? t('state.loading', { ns: 'common' }) : t('feed.loadMore')}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

