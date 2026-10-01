import { Heart, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { useSession } from '@/shared/hooks/useSession';
import { AuthorName } from '../AuthorName';
import { BookmarkButton } from '../BookmarkButton';
import { PostActionsMenu } from '../PostActionsMenu';
import { stripMarkdown } from '../editor/markdownParse';
import { useToggleLike } from '../hooks/usePosts';
import { getPostImageUrl } from '../imageProcessing';
import type { Post } from '../types';
import { splitBody } from './channelHelpers';
import styles from './ChannelFeedCards.module.css';

/** 도시 채널의 글 카드 — 본문 첫 줄이 제목, 나머지가 발췌, 첫 사진이 오른쪽 썸네일 */
export function ChannelPostCard({ post }: { post: Post }) {
  const { t, i18n } = useTranslation('community');
  const { user } = useSession();
  const navigate = useNavigate();
  const toggleLike = useToggleLike(post.id, user?.id ?? null);
  const { title, excerpt } = splitBody(stripMarkdown(post.body));
  const cover = post.images?.[0];
  const name = post.author?.display_name ?? '';

  function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    if (!user || toggleLike.isPending) return;
    toggleLike.mutate(!!post.likedByMe);
  }

  function handleAuthor(e: React.MouseEvent) {
    e.preventDefault();
    navigate(`/community/user/${post.author_id}`);
  }

  return (
    <Link to={`/community/post/${post.id}`} className={styles.card}>
      <div className={styles.head}>
        <button type="button" className={styles.author} onClick={handleAuthor}>
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className={styles.avatar} />
          ) : (
            <span className={styles.avatarFallback}>
              {name.trim().slice(0, 1).toUpperCase() || '?'}
            </span>
          )}
          <span className={styles.authorText}>
            <span className={styles.authorName}>
              <AuthorName profile={post.author} />
            </span>
            <span className={styles.time}>
              {formatDistanceToNowStrict(new Date(post.created_at), {
                addSuffix: true,
                locale: DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko,
              })}
            </span>
          </span>
        </button>
        <div onClick={(e) => e.preventDefault()}>
          <PostActionsMenu targetType="post" targetId={post.id} authorId={post.author_id} />
        </div>
      </div>

      <div className={cover ? styles.bodyWithCover : styles.body}>
        <div className={styles.text}>
          <h3 className={styles.title}>{title}</h3>
          {excerpt ? <p className={styles.excerpt}>{excerpt}</p> : null}
        </div>
        {cover ? (
          <img
            src={getPostImageUrl(cover.storage_path)}
            alt=""
            className={styles.thumb}
            loading="lazy"
          />
        ) : null}
      </div>

      <div className={styles.footer}>
        <button
          type="button"
          className={styles.stat}
          onClick={handleLike}
          disabled={!user}
          aria-pressed={!!post.likedByMe}
          aria-label={t('post.likeAria', { count: post.like_count })}
        >
          <Heart size={18} fill={post.likedByMe ? 'currentColor' : 'none'} aria-hidden="true" />{' '}
          {post.like_count}
        </button>
        <span
          className={styles.stat}
          aria-label={t('post.commentAria', { count: post.comment_count })}
        >
          <MessageCircle size={18} aria-hidden="true" /> {post.comment_count}
        </span>
        <BookmarkButton post={post} className={`${styles.stat} ${styles.pushRight}`} />
      </div>
    </Link>
  );
}
