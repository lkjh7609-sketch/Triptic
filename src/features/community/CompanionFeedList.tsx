import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { DestinationSelector } from './DestinationSelector';
import { useCompanionPostsFeed } from './hooks/useCompanionPosts';
import type { Destination } from './types';
import styles from './CompanionFeedList.module.css';

interface CompanionFeedListProps {
  destinations?: Destination[];
}

/** 동행찾기 탭 본문 — 모집중인 글만 보여준다(0032). 전체/구독 피드와 같은 탭
 * 안에서 상태만 전환되고, 별도 라우트는 없다(글쓰기/상세/매칭만 라우트). */
export function CompanionFeedList({ destinations }: CompanionFeedListProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const [destinationId, setDestinationId] = useState<string | undefined>(undefined);
  const feed = useCompanionPostsFeed({ destinationId, viewerId: user?.id ?? null });
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className={styles.wrap}>
      {destinations && destinations.length > 0 ? (
        <DestinationSelector
          destinations={destinations}
          selectedDestinationId={destinationId}
          onCitySelect={(city) => setDestinationId((cur) => (cur === city.id ? undefined : city.id))}
        />
      ) : null}

      {feed.isLoading ? (
        <div className={styles.loadingWrap}>
          <Skeleton height="120px" />
          <Skeleton height="120px" />
        </div>
      ) : feed.isError ? (
        <ErrorState summary={t('feed.loadError')} onRetry={() => feed.refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Users size={32} aria-hidden="true" />}
          message={t('companion.list.empty')}
          actions={
            <Link to="/community/companion/new" className={styles.emptyCta}>
              {t('companion.list.writeFirst')}
            </Link>
          }
        />
      ) : (
        <>
          <div className={styles.list}>
            {posts.map((post) => (
              <Link key={post.id} to={`/community/companion/${post.id}`} className={styles.card}>
                <h3 className={styles.cardTitle}>{post.title}</h3>
                <div className={styles.cardMeta}>
                  <span>{post.destination?.name ?? t('companion.detail.anyDestination')}</span>
                  <span>{t('companion.detail.dateRange', { start: post.start_date, end: post.end_date })}</span>
                  <span>{t('companion.detail.groupSize', { count: post.group_size })}</span>
                </div>
                <p className={styles.cardBody}>{post.body}</p>
              </Link>
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
