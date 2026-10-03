import { BadgeCheck, CircleHelp, Heart, MessageCircle, PenLine } from 'lucide-react';
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

/** 도시 채널의 글 카드 — 본문 첫 줄이 제목, 나머지가 발췌, 첫 사진이 오른쪽 썸네일. 질문(qna) 글은 답변 수·채택 답변이 붙는다 */
export function ChannelPostCard({
  post,
  onTagClick,
}: {
  post: Post;
  onTagClick?: (tag: string) => void;
}) {
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

  function handleTag(e: React.MouseEvent, tag: string) {
    e.preventDefault();
    onTagClick?.(tag);
  }

  const isQna = post.category === 'qna';
  const accepted = post.accepted_comment;

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
              {t('channel.categoryTime', {
                time: formatDistanceToNowStrict(new Date(post.created_at), {
                  addSuffix: true,
                  locale: DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko,
                }),
                category: t(`postCategory.${post.category}`),
              })}
            </span>
          </span>
        </button>
        {isQna ? (
          <span className={styles.answerPill}>
            <CircleHelp size={14} aria-hidden="true" />
            {t('channel.qna.answers', { count: post.comment_count })}
          </span>
        ) : null}
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

      {post.tags.length > 0 ? (
        <div className={styles.tags}>
          {post.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.tag}
              onClick={(e) => handleTag(e, tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      ) : null}

      {isQna && accepted ? (
        <div className={styles.acceptedBox}>
          <BadgeCheck size={20} aria-hidden="true" className={styles.acceptedIcon} />
          <div className={styles.acceptedText}>
            <span className={styles.acceptedLabel}>
              {t('channel.qna.accepted', {
                name: accepted.author?.display_name ?? t('post.fallbackAuthor'),
              })}
            </span>
            <p>{accepted.body}</p>
          </div>
        </div>
      ) : null}

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
        {isQna ? (
          <span className={styles.stat}>
            <PenLine size={18} aria-hidden="true" /> {t('channel.qna.answerCta')}
          </span>
        ) : null}
        <BookmarkButton post={post} className={`${styles.stat} ${styles.pushRight}`} />
      </div>
    </Link>
  );
}
