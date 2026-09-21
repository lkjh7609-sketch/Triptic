import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { usePostsFeed } from './hooks/usePosts';
import { useDestinations } from './hooks/useDestinations';
import { useFollowedDestinationIds } from './hooks/useCommunitySafety';
import { PostCard } from './PostCard';
import styles from './CommunityScreen.module.css';

type Tab = 'all' | 'following';

/**
 * 커뮤니티 탭 — 피드 (02-screens.md §4.1, 06-community.md §1)
 * 06-community.md §5(모더레이션 안전장치)와 같은 커밋에서 함께 구현했다.
 */
export function CommunityScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('all');
  const { data: destinations } = useDestinations();
  const { data: followedIds } = useFollowedDestinationIds(user?.id ?? null);

  const feed = usePostsFeed({ tab, viewerId: user?.id ?? null });

  useEffect(() => {
    trackScreenView('community_feed');
  }, []);

  const followedDestinations = (destinations ?? []).filter((d) => (followedIds ?? []).includes(d.id));
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <h1 className={styles.title}>{t('feed.title')}</h1>
        {user ? (
          <Link to="/community/compose" className={styles.composeBtn}>
            {t('feed.compose')}
          </Link>
        ) : null}
      </div>

      {followedDestinations.length > 0 ? (
        <div className={styles.chipRow}>
          {followedDestinations.map((d) => (
            <Link key={d.id} to={`/community/d/${d.slug}`} className={styles.chip}>
              {d.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className={styles.tabs}>
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

      {tab === 'following' && !user ? (
        <EmptyState icon="🔒" message={t('feed.loginToFollow')} />
      ) : feed.isLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton height="80px" />
          <div style={{ height: 12 }} />
          <Skeleton height="80px" />
        </div>
      ) : feed.isError ? (
        <ErrorState summary={t('feed.loadError')} onRetry={() => feed.refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon="💬"
          message={tab === 'following' ? t('feed.emptyFollowing') : t('feed.emptyAll')}
        />
      ) : (
        <>
          <div className={styles.list}>
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
