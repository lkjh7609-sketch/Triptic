import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { differenceInCalendarDays, formatDistanceToNowStrict } from 'date-fns';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { useSession } from '@/shared/hooks/useSession';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { AuthorName } from './AuthorName';
import { prefsLabel, sanitizeTags, spotsLeft } from './companionPrefs';
import { useCompanionPostsFeed, useMyActiveCompanionPosts } from './hooks/useCompanionPosts';
import type { CompanionPost, MyCompanionPost } from './types';
import styles from './CompanionFeedList.module.css';
import { useRequireLogin } from '@/features/auth/loginPrompt';

interface CompanionFeedListProps {
  /** 도시 선택은 전체·구독 탭과 같은 자리(탭 위·아래 공통 줄)에 있어서 부모가 들고 있다 */
  destinationId?: string;
  /** '내 동행모집' 버튼을 눌렀을 때 — 공개 피드 대신 내가 모집 중인 글만 보여 준다 */
  hostingOnly?: boolean;
}

/** 동행찾기 탭 본문 — 모집중인 글만 보여준다(0032). 전체/구독 피드와 같은 탭
 * 안에서 상태만 전환되고, 별도 라우트는 없다(글쓰기/상세/매칭만 라우트). */
export function CompanionFeedList({ destinationId, hostingOnly = false }: CompanionFeedListProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const requireLogin = useRequireLogin();
  const feed = useCompanionPostsFeed({ destinationId, viewerId: user?.id ?? null });
  // 내 모집글도 피드에 그대로 나온다('내 동행' 줄에는 신청한 글·확정된 글만 있어서 겹치지 않는다)
  const posts = feed.data?.pages.flatMap((p) => p.posts) ?? [];

  if (hostingOnly && user) return <HostingList userId={user.id} />;

  return (
    <div className={styles.wrap}>
      {user ? <MyCompanionsSection userId={user.id} /> : null}
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{t('companion.mine.feedTitle')}</h2>
        <span className={styles.sectionNote}>{t('channel.sort.latest')}</span>
      </div>

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
              <CompanionFeedCard key={post.id} post={post} />
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

/** 모집글 한 장 — 제목·시간 / 작성자(나잇대·성별)·여행지·일정 / 'N명 모집 | 원하는 동행' / 본문 / 태그 */
export function CompanionFeedCard({ post }: { post: CompanionPost }) {
  const { t, i18n } = useTranslation('community');
  const prefs = prefsLabel(post, t);
  const tags = sanitizeTags(post.tags);

  return (
    <Link to={`/community/companion/${post.id}`} className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{post.title}</h3>
        <span className={styles.cardTime}>
          {formatDistanceToNowStrict(new Date(post.created_at), {
            addSuffix: true,
            locale: DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko,
          })}
        </span>
      </div>
      <div className={styles.cardMeta}>
        <span className={styles.metaAuthor}>
          <AuthorName profile={post.author} />
        </span>
        <span className={post.destination ? styles.metaPlace : styles.metaMuted}>
          {post.destination?.name ?? t('companion.detail.anyDestination')}
        </span>
        <span className={styles.metaDate}>
          {post.start_date && post.end_date
            ? t('companion.detail.dateRange', { start: post.start_date, end: post.end_date })
            : t('companion.detail.dateTbd')}
        </span>
      </div>
      <div className={styles.recruitBox}>
        <strong className={styles.recruitCount}>{t('channel.recruitCount', { count: spotsLeft(post) })}</strong>
        {prefs ? (
          <>
            <span className={styles.recruitSep} aria-hidden="true">|</span>
            <span>{prefs}</span>
          </>
        ) : null}
      </div>
      {post.body ? <p className={styles.cardBody}>{post.body}</p> : null}
      {tags.length > 0 ? (
        <div className={styles.cardTags}>
          {tags.map((tag) => (
            <span key={tag} className={styles.cardTag}>#{t(`companion.tags.${tag}`)}</span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

/** '내 동행모집' — 내가 쓴 모집 중인 글만(확정·종료된 글은 '내 동행'에 있다) */
function HostingList({ userId }: { userId: string }) {
  const { t } = useTranslation(['community', 'common']);
  const requireLogin = useRequireLogin();
  const { data, isLoading, isError, refetch } = useMyActiveCompanionPosts(userId);
  const posts = (data ?? []).filter((p) => p.author_id === userId && p.status === 'recruiting');

  return (
    <div className={styles.wrap}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{t('companion.mine.hostingButton')}</h2>
        {posts.length > 0 ? <span className={styles.sectionNote}>{t('companion.mine.activeCount', { count: posts.length })}</span> : null}
      </div>
      {isLoading ? (
        <div className={styles.loadingWrap}>
          <Skeleton height="120px" />
          <Skeleton height="120px" />
        </div>
      ) : isError ? (
        <ErrorState summary={t('feed.loadError')} onRetry={() => refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Users size={32} aria-hidden="true" />}
          message={t('companion.mine.hostingEmpty')}
          actions={
            <Link to="/community/companion/new" className={styles.emptyCta} onClick={requireLogin}>
              {t('companion.list.writeFirst')}
            </Link>
          }
        />
      ) : (
        <div className={styles.list}>
          {posts.map((post) => (
            <CompanionFeedCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}

/** D-day — 시작일이 오늘 이후일 때만(날짜 미정이거나 이미 지났으면 숨김) */
function ddayLabel(post: CompanionPost, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  if (!post.start_date) return null;
  const diff = differenceInCalendarDays(new Date(`${post.start_date}T00:00:00`), new Date());
  if (diff < 0) return null;
  return diff === 0 ? t('companion.mine.ddayToday') : t('companion.mine.dday', { count: diff });
}

/** 내 동행 — 확정되면 공개 목록에서 빠지므로 지원자가 채팅방으로 돌아올 곳이 여기뿐이다 */
function MyCompanionsSection({ userId }: { userId: string }) {
  const { t } = useTranslation(['community', 'common']);
  const { data } = useMyActiveCompanionPosts(userId);
  // 내가 모집 중인 글은 '내 동행모집' 버튼에서 보므로 여기서는 뺀다 — 신청한 글·확정된 글(채팅방 입구)만
  const posts = (data ?? []).filter((p) => !(p.author_id === userId && p.status === 'recruiting'));
  if (posts.length === 0) return null;

  function statusLabel(post: MyCompanionPost) {
    if (post.needsReview) return t('companion.mine.needsReview');
    if (post.status === 'matched') return t('companion.mine.matched');
    if (post.author_id === userId) return t('companion.mine.hosting');
    return post.myApplication ? t(`companion.detail.myApplicationStatus.${post.myApplication.status}`) : '';
  }

  return (
    <section className={styles.mineSection} aria-labelledby="my-companions-title">
      <div className={styles.sectionHead}>
        <h2 id="my-companions-title" className={styles.sectionTitle}>
          {t('companion.mine.title')}
          <span className={styles.countBadge}>{posts.length}</span>
        </h2>
        <span className={styles.sectionNote}>{t('companion.mine.activeCount', { count: posts.length })}</span>
      </div>
      <div className={styles.mineScroll}>
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
            className={styles.mineCard}
          >
            <div className={styles.mineTop}>
              <span className={post.status === 'recruiting' ? styles.mineBadge : styles.mineBadgeActive}>{statusLabel(post)}</span>
              {ddayLabel(post, t) ? <span className={styles.mineDday}>{ddayLabel(post, t)}</span> : null}
            </div>
            <h3 className={styles.mineName}>{post.title}</h3>
            <div className={styles.mineInfo}>
              <span className={post.destination ? styles.minePlace : undefined}>{post.destination?.name ?? t('companion.detail.anyDestination')}</span>
              <span className={styles.mineDate}>{post.start_date && post.end_date ? t('companion.detail.dateRange', { start: post.start_date, end: post.end_date }) : t('companion.detail.dateTbd')}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
