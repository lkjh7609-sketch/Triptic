import { Bookmark, Eye, MessageCircle, Pin } from 'lucide-react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { stripMarkdown } from '../editor/markdownParse';
import type { Post } from '../types';
import { splitBody } from './channelHelpers';
import styles from './ChannelPinnedCard.module.css';

/** 도시의 '트립틱 공식 필독 가이드' — 관리자가 고정한 글, 모든 탭에서 목록 맨 위에 보인다 */
export function ChannelPinnedCard({
  post,
  onTagClick,
}: {
  post: Post;
  onTagClick?: (tag: string) => void;
}) {
  const { t, i18n } = useTranslation('community');
  const { title, excerpt } = splitBody(stripMarkdown(post.body));
  const updated = new Date(post.updated_at || post.created_at).toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: '2-digit',
  });

  return (
    <Link to={`/community/post/${post.id}`} className={styles.card}>
      <span className={styles.bar} aria-hidden="true" />
      <div className={styles.head}>
        <span className={styles.label}>
          <Pin size={16} aria-hidden="true" />
          {t('channel.pinned.label')}
        </span>
        <span className={styles.updated}>{t('channel.pinned.updated', { date: updated })}</span>
      </div>
      <h2 className={styles.title}>{title}</h2>
      {excerpt ? <p className={styles.excerpt}>{excerpt}</p> : null}
      <div className={styles.foot}>
        <div className={styles.tags}>
          {post.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles.tag}
              onClick={(e) => {
                e.preventDefault();
                onTagClick?.(tag);
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
        <div className={styles.stats}>
          <span
            className={styles.stat}
            aria-label={t('channel.pinned.views', { count: post.view_count })}
          >
            <Eye size={16} aria-hidden="true" /> {post.view_count.toLocaleString(i18n.language)}
          </span>
          <span
            className={styles.stat}
            aria-label={t('channel.pinned.saves', { count: post.bookmark_count ?? 0 })}
          >
            <Bookmark size={16} aria-hidden="true" />{' '}
            {(post.bookmark_count ?? 0).toLocaleString(i18n.language)}
          </span>
          <span
            className={styles.stat}
            aria-label={t('channel.pinned.comments', { count: post.comment_count })}
          >
            <MessageCircle size={16} aria-hidden="true" />{' '}
            {post.comment_count.toLocaleString(i18n.language)}
          </span>
        </div>
      </div>
    </Link>
  );
}
