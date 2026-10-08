import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Heart, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { AuthorName } from './AuthorName';
import { spotsLeft } from './companionPrefs';
import { postTitleOf } from './postMeta';
import type { AllFeedItem } from './hooks/useAllFeedItems';
import styles from './BoardRow.module.css';

/** PC에서 목록 맨 위에 붙는 머리줄 — 모바일에서는 CSS로 숨긴다 */
export function BoardHead() {
  const { t } = useTranslation('community');
  return (
    <div className={styles.head} aria-hidden="true">
      <span>{t('feed.boardHead.title')}</span>
      <span className={styles.cAuthor}>{t('feed.boardHead.author')}</span>
      <span className={styles.cDate}>{t('feed.boardHead.date')}</span>
      <span className={styles.cNum}>{t('feed.boardHead.likes')}</span>
      <span className={styles.cNum}>{t('feed.boardHead.comments')}</span>
    </div>
  );
}

/**
 * 전체 게시판 한 줄 — 제목을 길게 보여 주는 게시판형(사진·본문 없음).
 * 일반 글은 [도시] 제목 · 작성자 · 시간 · 좋아요·댓글 수, 동행 모집글은 '동행 모집' 알약 + [여행지] 제목 + 남은 자리.
 * 도시별 게시판·동행 탭은 카드형을 그대로 쓴다.
 */
export function BoardRow({ item }: { item: AllFeedItem }) {
  const { t, i18n } = useTranslation('community');
  const locale = DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko;
  const time = formatDistanceToNowStrict(new Date(item.post.created_at), { addSuffix: true, locale });

  if (item.kind === 'companion') {
    const post = item.post;
    return (
      <Link to={`/community/companion/${post.id}`} className={styles.row}>
        <span className={styles.titleCell}>
          <span className={styles.pill}>{t('companion.list.badge')}</span>
          <span className={styles.place}>{post.destination?.name ?? t('companion.detail.anyDestination')}</span>
          <span className={styles.title}>{post.title}</span>
        </span>
        <span className={styles.cAuthor}>
          <AuthorName profile={post.author} />
        </span>
        <span className={styles.cDate}>{time}</span>
        <span className={styles.cSpots}>{t('channel.recruitCount', { count: spotsLeft(post) })}</span>
      </Link>
    );
  }

  const post = item.post;
  return (
    <Link to={`/community/post/${post.id}`} className={styles.row}>
      <span className={styles.titleCell}>
        <span className={styles.place}>{post.destination?.name ?? t('board.free')}</span>
        <span className={styles.title}>{postTitleOf(post)}</span>
        {post.images && post.images.length > 0 ? (
          <ImageIcon size={14} className={styles.photo} aria-label={t('feed.boardHead.photo')} />
        ) : null}
      </span>
      <span className={styles.cAuthor}>
        <AuthorName profile={post.author} />
      </span>
      <span className={styles.cDate}>{time}</span>
      <span className={`${styles.cNum} ${styles.cLike}`}>
        <Heart size={13} aria-hidden="true" className={styles.numIcon} />
        {post.like_count}
      </span>
      <span className={`${styles.cNum} ${styles.cComment}`}>
        <MessageCircle size={13} aria-hidden="true" className={styles.numIcon} />
        {post.comment_count}
      </span>
    </Link>
  );
}
