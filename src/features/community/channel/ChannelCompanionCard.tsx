import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { AuthorName } from '../AuthorName';
import { prefsLabel, spotsLeft } from '../companionPrefs';
import type { CompanionPost } from '../types';
import styles from './ChannelFeedCards.module.css';

/** 도시 채널의 동행 구하기 카드 — 있는 값만(제목·발췌·일정·모집 인원·희망 성별·신청 버튼) */
export function ChannelCompanionCard({ post }: { post: CompanionPost }) {
  const { t, i18n } = useTranslation('community');
  const name = post.author?.display_name ?? '';
  const prefs = prefsLabel(post, t);

  return (
    <Link to={`/community/companion/${post.id}`} className={styles.card}>
      <div className={styles.head}>
        <div className={styles.author}>
          {post.author?.avatar_url ? (
            <img src={post.author.avatar_url} alt="" className={styles.avatar} />
          ) : (
            <span className={styles.avatarFallback}>
              {name.trim().slice(0, 1).toUpperCase() || '?'}
            </span>
          )}
          <span className={styles.authorText}>
            <span className={styles.authorLine}>
              <span className={styles.authorName}>
                <AuthorName profile={post.author} />
              </span>
              <span className={styles.badge}>{t('channel.recruiting')}</span>
            </span>
            <span className={styles.time}>
              {formatDistanceToNowStrict(new Date(post.created_at), {
                addSuffix: true,
                locale: DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko,
              })}
            </span>
          </span>
        </div>
        <span className={styles.countPill}>
          {t('channel.recruitCount', { count: spotsLeft(post) })}
        </span>
      </div>

      <div className={styles.text}>
        <h3 className={styles.title}>{post.title}</h3>
        {post.body ? <p className={styles.excerpt}>{post.body}</p> : null}
      </div>

      <div className={styles.scheduleRow}>
        <span className={styles.scheduleInfo}>
          <CalendarDays size={18} aria-hidden="true" />
          <span>
            {t('channel.schedule')}:{' '}
            <strong>
              {post.start_date && post.end_date
                ? t('companion.detail.dateRange', { start: post.start_date, end: post.end_date })
                : t('channel.scheduleTbd')}
            </strong>
            {prefs ? ` · ${prefs}` : ''}
          </span>
        </span>
        <span className={styles.applyBtn}>{t('channel.applyBtn')}</span>
      </div>
    </Link>
  );
}
