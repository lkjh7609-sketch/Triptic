import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Heart, MessageCircle } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { AuthorName } from './AuthorName';
import { spotsLeft } from './companionPrefs';
import { getPostImageUrl } from './imageProcessing';
import { postTitleOf } from './postMeta';
import type { AllFeedItem } from './hooks/useAllFeedItems';
import styles from './BoardRow.module.css';

/** PC에서 목록 맨 위에 붙는 머리줄 — 모바일에서는 CSS로 숨긴다 */
export function BoardHead() {
  const { t } = useTranslation('community');
  return (
    <div className={styles.head} aria-hidden="true">
      <span className={styles.hPlace} />
      <span className={styles.hTitle}>{t('feed.boardHead.title')}</span>
      <span className={styles.cAuthor}>{t('feed.boardHead.author')}</span>
      <span className={styles.cDate}>{t('feed.boardHead.date')}</span>
      <span className={`${styles.cNum} ${styles.cLike}`}>{t('feed.boardHead.likes')}</span>
      <span className={`${styles.cNum} ${styles.cComment}`}>{t('feed.boardHead.comments')}</span>
    </div>
  );
}

/**
 * 전체 게시판 한 줄 — 제목을 길게 보여 주는 게시판형. 줄 높이는 사진 유무와 상관없이 같다(사진이 있으면 제목 오른쪽에 작은 썸네일).
 * 칸: [분류·도시] 제목 … 썸네일 | 작성자 | 작성일 | 좋아요 | 댓글. 분류 칸은 폭이 고정이라 줄마다 같은 자리에 선다.
 * 동행 모집글은 좋아요·댓글 칸 자리에 '동행 모집 · N명 남음'이 들어간다.
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
        <span className={styles.place}>{post.destination?.name ?? t('companion.detail.anyDestination')}</span>
        <span className={`${styles.title} ${styles.titleWide}`}>{post.title}</span>
        <span className={styles.meta}>
          <span className={styles.cAuthor}>
            <AuthorName profile={post.author} />
          </span>
          <span className={styles.cDate}>{time}</span>
        </span>
        <span className={styles.cSpots}>
          <span className={styles.pill}>{t('companion.list.badge')}</span>
          {t('channel.recruitCount', { count: spotsLeft(post) })}
        </span>
      </Link>
    );
  }

  const post = item.post;
  const cover = post.images?.[0];
  return (
    <Link to={`/community/post/${post.id}`} className={styles.row}>
      <span className={styles.place}>{post.destination?.name ?? t('board.free')}</span>
      <span className={cover ? styles.title : `${styles.title} ${styles.titleWide}`}>{postTitleOf(post)}</span>
      {cover ? (
        <span className={styles.thumb}>
          <img src={getPostImageUrl(cover.storage_path)} alt="" className={styles.thumbImg} loading="lazy" />
          {post.images && post.images.length > 1 ? <span className={styles.thumbCount}>+{post.images.length - 1}</span> : null}
        </span>
      ) : null}
      <span className={styles.meta}>
        <span className={styles.cAuthor}>
          <AuthorName profile={post.author} />
        </span>
        <span className={styles.cDate}>{time}</span>
      </span>
      <span className={styles.stats}>
        <span className={`${styles.cNum} ${styles.cLike}`}>
          <Heart size={13} aria-hidden="true" className={styles.numIcon} />
          {post.like_count}
        </span>
        <span className={`${styles.cNum} ${styles.cComment}`}>
          <MessageCircle size={13} aria-hidden="true" className={styles.numIcon} />
          {post.comment_count}
        </span>
      </span>
    </Link>
  );
}
