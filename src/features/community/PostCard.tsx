import { MessageCircle, Heart } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useToggleLike } from './hooks/usePosts';
import { PostActionsMenu } from './PostActionsMenu';
import { getPostImageUrl } from './imageProcessing';
import type { Post } from './types';
import styles from './PostCard.module.css';

interface PostCardProps {
  post: Post;
  /** destination 배지 노출 여부(전체 피드에서는 표시, 채널 안에서는 생략) */
  showDestination?: boolean;
}

export function PostCard({ post, showDestination = true }: PostCardProps) {
  const { t } = useTranslation('community');
  const { user } = useSession();
  const navigate = useNavigate();
  const toggleLike = useToggleLike(post.id, user?.id ?? null);

  function handleLikeClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) return;
    toggleLike.mutate(!!post.likedByMe);
  }

  function handleAuthorClick(e: React.MouseEvent) {
    e.preventDefault();
    navigate(`/community/user/${post.author_id}`);
  }

  return (
    <Link to={`/community/post/${post.id}`} className={styles.card}>
      <div className={styles.header}>
        <div className={styles.author} onClick={handleAuthorClick}>
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className={styles.avatar} />
          ) : (
            <span className={styles.avatarFallback}>🅤</span>
          )}
          <span className={styles.authorName}>{post.author?.display_name || t('post.fallbackAuthor')}</span>
          {showDestination && post.destination?.name ? (
            <span className={styles.destinationBadge}>· {post.destination.name}</span>
          ) : null}
          <span className={styles.time}>
            · {formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: true, locale: ko })}
          </span>
        </div>
        <div onClick={(e) => e.preventDefault()}>
          <PostActionsMenu targetType="post" targetId={post.id} authorId={post.author_id} />
        </div>
      </div>

      <p className={styles.body}>{post.body}</p>

      {post.images && post.images.length > 0 ? (
        <div className={styles.images}>
          {post.images.slice(0, 3).map((img) => (
            <img key={img.id} src={getPostImageUrl(img.storage_path)} alt="" className={styles.image} />
          ))}
          {post.images.length > 3 ? <span className={styles.moreImages}>+{post.images.length - 3}</span> : null}
        </div>
      ) : null}

      <div className={styles.footer}>
        <button type="button" className={styles.likeBtn} onClick={handleLikeClick} disabled={!user}>
          {post.likedByMe ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Heart size={16} /></span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Heart size={16} /></span>} {post.like_count}
        </button>
        <span className={styles.commentCount}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={16} /></span> {post.comment_count}</span>
      </div>
    </Link>
  );
}
