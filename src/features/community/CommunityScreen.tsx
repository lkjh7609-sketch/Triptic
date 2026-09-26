import { Lock as LockIcon, PenLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
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
import styles from './CommunityScreen.module.css';
import { CommunityDesignBody } from './CommunityDesign';

type Tab = 'all' | 'following';

export function CommunityScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [tab, setTab] = useState<Tab>('all');
  const { data: destinations } = useDestinations();
  const { data: followedIds } = useFollowedDestinationIds(user?.id ?? null);

  const feed = usePostsFeed({ tab, viewerId: user?.id ?? null });
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const handleSearch = () => {
    if (!searchQuery) return;
    const dest = destinations?.find(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.slug.toLowerCase().includes(searchQuery.toLowerCase()));
    if (dest) {
      navigate(`/community/d/${dest.slug}`);
    } else {
      alert(t('feed.searchError', { defaultValue: '해당 도시 게시판을 찾을 수 없습니다.' }));
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
        <CommunityDesignBody
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          handleSearch={handleSearch}
          destinations={destinations}
          tab={tab}
          setTab={setTab}
          followedCount={followedDestinations.length}
          feed={feed}
        />
      </div>
    );
  }

  return (
    <div className={`${styles.wrap} ${styles.desktopWrap}`}>
      {user ? (
        <Link to="/community/compose" className={styles.fabBtnDesktop}>
          <PenLine size={20} /> <span>{t('feed.writeBtn', { defaultValue: '글쓰기' })}</span>
        </Link>
      ) : null}

      <div className={styles.headerSection}>
        <div className={styles.subtitle}>{t('feed.subtitle', { defaultValue: '여행자들의 기록과 영감' })}</div>
        <h1 className={styles.mainTitle}>{t('feed.title')}</h1>
      </div>

      <div className={styles.filterSection}>
        <div className={styles.searchBarWrap}>
          <input 
            type="text" 
            className={styles.searchInput} 
            placeholder={t('feed.searchPlaceholder', { defaultValue: '지역, 키워드, 여행자 검색...' })} 
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
        </div>

        {destinations && destinations.length > 0 ? (
          <DestinationSelector destinations={destinations} />
        ) : null}

        {followedDestinations.length > 0 ? (
          <div className={styles.chipRow}>
            {followedDestinations.map((d) => (
              <Link key={d.id} to={`/community/d/${d.slug}`} className={styles.chip}>
                {d.name}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {tab === 'following' && !user ? (
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
            <h3>{tab === 'following' ? t('feed.emptyFollowing') : t('feed.emptyAll', { defaultValue: '아직 등록된 글이 없어요.' })}</h3>
            <p>{t('feed.emptySub', { defaultValue: '첫 번째 여행의 순간과 로컬 인사이트를 공유해보세요.' })}</p>
            <Link to="/community/compose" className={styles.emptyCta}>{t('feed.writeFirst', { defaultValue: '첫 이야기 작성하기' })}</Link>
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

