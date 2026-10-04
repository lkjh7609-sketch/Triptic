import { MessageCircle, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useToggleLike } from './hooks/usePosts';
import { AuthorName } from './AuthorName';
import { BookmarkButton } from './BookmarkButton';
import { CATEGORY_ICONS } from './categoryIcons';
import { getPostImageUrl } from './imageProcessing';
import { postTitleOf } from './postMeta';
import type { Post } from './types';
import styles from './PostCard.module.css';

interface PostCardProps {
  post: Post;
  /** destination 배지 노출 여부(전체 피드에서는 표시, 채널 안에서는 생략) */
  showDestination?: boolean;
}

/**
 * 피드 카드 — 작게: 왼쪽 대표 사진(없으면 분류 아이콘 자리), 오른쪽에 도시·분류 칩, 제목, 작성자·시간, 숫자.
 * 목록에는 제목만 보이고 본문은 글을 열어야 보인다(Stitch/Community/Post).
 */
export function PostCard({ post, showDestination = true }: PostCardProps) {
  const { t, i18n } = useTranslation('community');
  const { user } = useSession();
  const navigate = useNavigate();
  const toggleLike = useToggleLike(post.id, user?.id ?? null);
  const cover = post.images?.[0];
  const CategoryIcon = CATEGORY_ICONS[post.category];

  function handleLikeClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) return;
    toggleLike.mutate(!!post.likedByMe);
  }

  function handleAuthorClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/community/user/${post.author_id}`);
  }

  return (
    <Link to={`/community/post/${post.id}`} className={styles.card}>
      <span className={styles.thumb}>
        {cover ? (
          <img src={getPostImageUrl(cover.storage_path)} alt="" className={styles.thumbImg} loading="lazy" />
        ) : (
          <CategoryIcon size={22} aria-hidden="true" className={styles.thumbIcon} />
        )}
        {post.images && post.images.length > 1 ? <span className={styles.photoCount}>+{post.images.length - 1}</span> : null}
      </span>

      <span className={styles.main}>
        <span className={styles.chips}>
          {showDestination && post.destination?.name ? <span className={styles.chip}>{post.destination.name}</span> : null}
          <span className={styles.chipMuted}>{t(`postCategory.${post.category}`)}</span>
        </span>
        <span className={styles.title}>{postTitleOf(post)}</span>
        <span className={styles.metaRow}>
          <button type="button" className={styles.authorBtn} onClick={handleAuthorClick}>
            <AuthorName profile={post.author} />
          </button>
          <span className={styles.time}>
            · {formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: true, locale: DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko })}
          </span>
        </span>
        <span className={styles.footer}>
          <button
            type="button"
            className={styles.likeBtn}
            onClick={handleLikeClick}
            disabled={!user}
            aria-pressed={!!post.likedByMe}
            aria-label={t('post.likeAria', { count: post.like_count })}
          >
            <Heart size={14} fill={post.likedByMe ? 'currentColor' : 'none'} aria-hidden="true" /> {post.like_count}
          </button>
          <span className={styles.commentCount} aria-label={t('post.commentAria', { count: post.comment_count })}>
            <MessageCircle size={14} aria-hidden="true" /> {post.comment_count}
          </span>
          <BookmarkButton post={post} className={styles.likeBtn} />
        </span>
      </span>
    </Link>
  );
}
