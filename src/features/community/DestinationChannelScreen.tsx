import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { useDestination } from './hooks/useDestinations';
import { usePostsFeed } from './hooks/usePosts';
import { useFollowedDestinationIds, useToggleFollow } from './hooks/useCommunitySafety';
import { PostCard } from './PostCard';
import styles from './DestinationChannelScreen.module.css';

/**
 * 여행지 채널 (02-screens.md §4.2, 06-community.md §1)
 * 기후 평년값(최적 시즌·평균 기온)은 climate_normals 실데이터가 아직
 * 비어 있어(Phase 3 잔여 갭) 이번 라운드에서는 생략한다 — 위치·통화·시차만 표시.
 */
export function DestinationChannelScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: destination, isLoading, isError, refetch } = useDestination(slug);
  const { data: followedIds } = useFollowedDestinationIds(user?.id ?? null);
  const toggleFollow = useToggleFollow(user?.id ?? null);

  useEffect(() => {
    trackScreenView('community_destination');
  }, []);

  const feed = usePostsFeed({ tab: 'all', destinationId: destination?.id, viewerId: user?.id ?? null });
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];
  const isFollowing = !!destination && (followedIds ?? []).includes(destination.id);

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="120px" />
      </div>
    );
  }
  if (isError || !destination) {
    return <ErrorState summary={t('destination.loadError')} onRetry={() => refetch()} />;
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
        ← {t('action.back', { ns: 'common' })}
      </button>
      <div className={styles.header}>
        <h1 className={styles.title}>{destination.name}</h1>
        <div className={styles.meta}>
          <span>🌏 {destination.country_code}</span>
          <span>🕐 {destination.timezone}</span>
          {destination.currency ? <span>💱 {destination.currency}</span> : null}
          <span>{t('destination.postCount', { count: destination.post_count })}</span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={isFollowing ? styles.followingBtn : styles.followBtn}
            disabled={!user || toggleFollow.isPending}
            onClick={() => toggleFollow.mutate({ destinationId: destination.id, following: isFollowing })}
          >
            {isFollowing ? t('destination.following') : t('destination.follow')}
          </button>
          <button type="button" className={styles.tripBtn} onClick={() => navigate('/plan')}>
            {t('destination.createTripHere')}
          </button>
        </div>
      </div>

      {feed.isLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton height="80px" />
        </div>
      ) : posts.length === 0 ? (
        <EmptyState icon="💬" message={t('destination.emptyPosts')} />
      ) : (
        <>
          <div className={styles.list}>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} showDestination={false} />
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
