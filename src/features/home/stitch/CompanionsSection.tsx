import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, ChevronRight, MessageCircle, UserPlus, Users } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { useCompanionPostsFeed } from '@/features/community/hooks/useCompanionPosts';
import type { CompanionPost } from '@/features/community/types';
import { prefsLabel, sanitizeTags } from '@/features/community/companionPrefs';
import { matchScore } from './matchScore';
import { useUpcomingTrip } from './useUpcomingTrip';
import shared from './shared.module.css';
import styles from './CompanionsSection.module.css';

const PC_LIMIT = 3;
const MOBILE_LIMIT = 2;

/** "05.02" — 카드 한 줄에 들어가는 월.일 */
function md(ymd: string): string {
  return ymd.slice(5).replace('-', '.');
}

function CompanionCard({ post, pct, desktop }: { post: CompanionPost; pct: number | null; desktop: boolean }) {
  const { t } = useTranslation(['home', 'community']);
  // 원하는 동행 — "20대 여성"·"20대·30대 무관". 조건이 없으면 표시하지 않는다
  const prefText = prefsLabel(post, (key) => t(`community:${key}`));
  const tags = sanitizeTags(post.tags);
  const author = post.author?.display_name ?? '';
  const destination = post.destination?.name ?? t('page.companions.anywhere');
  const dates =
    !post.start_date || !post.end_date
      ? t('community:companion.detail.dateTbd')
      : desktop
        ? `${md(post.start_date)} - ${md(post.end_date)}`
        : `${md(post.start_date).replace('.', '/')} ~ ${md(post.end_date).replace('.', '/')}`;

  return (
    <article className={`${shared.card} ${shared.cardHover} ${styles.card}`}>
      <div className={styles.main}>
        <div className={styles.topRow}>
          <div className={styles.topLeft}>
            {desktop ? (
              <>
                <span className={styles.recruit}>{t('page.companions.recruiting', { count: post.group_size })}</span>
                {prefText ? <span className={styles.muted}>{prefText}</span> : null}
              </>
            ) : pct !== null ? (
              <span className={styles.matchMobile}>
                <span className={styles.ping} aria-hidden="true" />
                {t('page.companions.match', { pct })}
              </span>
            ) : null}
            {desktop ? null : <span className={styles.muted}>{`${destination} · ${dates}`}</span>}
          </div>
          {desktop ? (
            pct !== null ? (
              <span className={styles.matchPc}>
                <BadgeCheck size={15} aria-hidden="true" /> {t('page.companions.match', { pct })}
              </span>
            ) : null
          ) : (
            <span className={styles.recruitMobile}>{t('page.companions.recruiting', { count: post.group_size })}</span>
          )}
        </div>
        {desktop ? (
          <div className={styles.place}>
            <span className={styles.placeName}>{destination}</span>
            <span className={styles.dot}>·</span>
            <span className={styles.muted}>{dates}</span>
          </div>
        ) : null}
        <h3 className={styles.title}>
          <Link to={`/community/companion/${post.id}`} className={styles.stretch}>
            {post.title}
          </Link>
        </h3>
        <p className={styles.body}>{post.body}</p>
        {tags.length > 0 ? (
          <div className={styles.tags}>
            {tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                #{t(`community:companion.tags.${tag}`)}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.foot}>
        <span className={styles.author}>
          <span className={styles.avatar}>{author.slice(0, desktop ? 1 : 2)}</span>
          <span className={styles.authorText}>
            <span className={styles.authorName}>{author}</span>
            {!desktop && prefText ? <span className={styles.muted}>{prefText}</span> : null}
          </span>
        </span>
        <Link to={`/community/companion/${post.id}`} className={styles.talk}>
          {desktop ? null : <MessageCircle size={16} aria-hidden="true" />}
          {t('page.companions.talk')}
        </Link>
      </div>
    </article>
  );
}

/** "같이 갈 사람 찾기" — 모집 중인 동행 글. 내 다음 여행이 있으면 도시·날짜가 맞는 글을 앞에 두고 일치율을 붙인다 */
export function CompanionsSection({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const { user } = useSession();
  const { view } = useUpcomingTrip(!!user);
  const feed = useCompanionPostsFeed({ viewerId: user?.id ?? null });
  const limit = desktop ? PC_LIMIT : MOBILE_LIMIT;

  const cards = useMemo(() => {
    const posts = (feed.data?.pages.flatMap((p) => p.posts) ?? []).filter((p) => p.author_id !== user?.id);
    const scored = posts.map((post, index) => ({
      post,
      index,
      pct: view
        ? matchScore(
            { destinationName: post.destination?.name, startDate: post.start_date, endDate: post.end_date },
            { city: view.trip.city, startDate: view.trip.start_date, endDate: view.trip.end_date },
          )
        : null,
    }));
    // 일치율이 높은 글을 앞에, 같으면 최신 순(받은 순서) 그대로
    scored.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.index - b.index);
    return scored.slice(0, limit);
  }, [feed.data, view, user?.id, limit]);

  return (
    <section className={shared.section} aria-labelledby="home-companions-title">
      <div className={shared.head}>
        <div className={shared.headText}>
          {desktop ? <div className={shared.eyebrow}>{t('page.companions.eyebrow')}</div> : null}
          <h2 id="home-companions-title" className={shared.title}>
            {t('page.companions.title')}
          </h2>
          <p className={shared.sub}>{desktop ? t('page.companions.sub') : t('page.companions.subMobile')}</p>
        </div>
        {desktop ? (
          <button
            type="button"
            className={shared.primaryBtn}
            onClick={() => {
              if (requireLogin()) navigate('/community/companion/new');
            }}
          >
            <UserPlus size={18} aria-hidden="true" />
            <span>{t('page.companions.write')}</span>
          </button>
        ) : (
          <Link to="/community?tab=companion" className={shared.moreLink}>
            {t('page.more')}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>

      {feed.isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: limit }, (_, i) => (
            <div key={i} className={`${shared.card} ${styles.card}`}>
              <Skeleton height="220px" />
            </div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className={`${shared.card} ${shared.emptyCard}`}>
          <span className={shared.emptyIcon}>
            <Users size={24} aria-hidden="true" />
          </span>
          <h3 className={shared.emptyTitle}>{t('page.companions.emptyTitle')}</h3>
          <p className={shared.emptyDesc}>{t('page.companions.emptyDesc')}</p>
          {desktop ? null : (
            <button
              type="button"
              className={`${shared.primaryBtn} ${shared.emptyBtn}`}
              onClick={() => {
                if (requireLogin()) navigate('/community/companion/new');
              }}
            >
              <UserPlus size={18} aria-hidden="true" />
              <span>{t('page.companions.write')}</span>
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {cards.map(({ post, pct }) => (
            <CompanionCard key={post.id} post={post} pct={pct} desktop={desktop} />
          ))}
        </div>
      )}
    </section>
  );
}
