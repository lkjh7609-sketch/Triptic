import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { DestinationSelector } from './DestinationSelector';
import { prefsLabel, sanitizeTags } from './companionPrefs';
import { useCompanionPostsFeed, useMyActiveCompanionPosts } from './hooks/useCompanionPosts';
import type { Destination, MyCompanionPost } from './types';
import styles from './CompanionFeedList.module.css';
import { useRequireLogin } from '@/features/auth/loginPrompt';

interface CompanionFeedListProps {
  destinations?: Destination[];
}

/** 동행찾기 탭 본문 — 모집중인 글만 보여준다(0032). 전체/구독 피드와 같은 탭
 * 안에서 상태만 전환되고, 별도 라우트는 없다(글쓰기/상세/매칭만 라우트). */
export function CompanionFeedList({ destinations }: CompanionFeedListProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const requireLogin = useRequireLogin();
  const [destinationId, setDestinationId] = useState<string | undefined>(undefined);
  const feed = useCompanionPostsFeed({ destinationId, viewerId: user?.id ?? null });
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  return (
    <div className={styles.wrap}>
      {user ? <MyCompanionsSection userId={user.id} /> : null}

      {destinations && destinations.length > 0 ? (
        <div className={styles.selectorGutter}>
          <DestinationSelector
            destinations={destinations}
            selectedDestinationId={destinationId}
            onCitySelect={(city) => setDestinationId(city.id)}
            onClear={() => setDestinationId(undefined)}
          />
        </div>
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
            <Link to="/community/companion/new" className={styles.emptyCta} onClick={requireLogin}>
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
                  <span>{post.start_date && post.end_date ? t('companion.detail.dateRange', { start: post.start_date, end: post.end_date }) : t('companion.detail.dateTbd')}</span>
                  <span>{t('companion.detail.groupSize', { count: post.group_size })}</span>
                  {prefsLabel(post, t) ? <span>{prefsLabel(post, t)}</span> : null}
                </div>
                <p className={styles.cardBody}>{post.body}</p>
                {sanitizeTags(post.tags).length > 0 ? (
                  <div className={styles.cardMeta}>
                    {sanitizeTags(post.tags).map((tag) => (
                      <span key={tag}>#{t(`companion.tags.${tag}`)}</span>
                    ))}
                  </div>
                ) : null}
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

/** 내 동행 — 확정되면 공개 목록에서 빠지므로 지원자가 채팅방으로 돌아올 곳이 여기뿐이다 */
function MyCompanionsSection({ userId }: { userId: string }) {
  const { t } = useTranslation(['community', 'common']);
  const { data: posts } = useMyActiveCompanionPosts(userId);
  if (!posts || posts.length === 0) return null;

  function statusLabel(post: MyCompanionPost) {
    if (post.needsReview) return t('companion.mine.needsReview');
    if (post.status === 'matched') return t('companion.mine.matched');
    if (post.author_id === userId) return t('companion.mine.hosting');
    return post.myApplication ? t(`companion.detail.myApplicationStatus.${post.myApplication.status}`) : '';
  }

  return (
    <section className={styles.mineSection} aria-labelledby="my-companions-title">
      <h2 id="my-companions-title" className={styles.mineTitle}>{t('companion.mine.title')}</h2>
      <div className={styles.list}>
        {posts.map((post) => (
          <Link
            key={post.id}
            to={
              post.needsReview
                ? `/community/companion/${post.id}/chat?review=1`
                : post.status === 'matched'
                  ? `/community/companion/${post.id}/chat`
                  : `/community/companion/${post.id}`
            }
            className={styles.card}
          >
            <span className={post.status === 'recruiting' ? styles.mineBadge : styles.mineBadgeActive}>{statusLabel(post)}</span>
            <h3 className={styles.cardTitle}>{post.title}</h3>
            <div className={styles.cardMeta}>
              <span>{post.destination?.name ?? t('companion.detail.anyDestination')}</span>
              <span>{post.start_date && post.end_date ? t('companion.detail.dateRange', { start: post.start_date, end: post.end_date }) : t('companion.detail.dateTbd')}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
