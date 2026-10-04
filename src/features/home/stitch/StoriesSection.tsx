import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookOpen, ChevronLeft, ChevronRight, Copy, Heart, MessageCircle, NotebookPen } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { usePopularPosts } from '@/features/community/hooks/usePosts';
import { getPostImageUrl } from '@/features/community/imageProcessing';
import type { Post } from '@/features/community/types';
import { relativeTime } from './relativeTime';
import { WritingGuideDialog } from './WritingGuideDialog';
import shared from './shared.module.css';
import styles from './StoriesSection.module.css';
import { postTitleOf } from '@/features/community/postMeta';

const PC_LIMIT = 8;
const MOBILE_LIMIT = 2;

function StoryCard({ post, desktop }: { post: Post; desktop: boolean }) {
  const { t, i18n } = useTranslation('home');
  const title = postTitleOf(post);
  const image = post.images?.[0] ? getPostImageUrl(post.images[0].storage_path) : null;
  const author = post.author?.display_name ?? '';
  const initial = author.slice(0, 1).toUpperCase();
  const destination = post.destination?.name;
  // 일정이 첨부돼 있고 작성자가 복사를 허용한 글만(허용 여부 값이 아직 없으면 허용으로 본다)
  const canCopy = !!post.trip_id && post.allow_copy !== false;
  const bookmarks = (post.bookmark_count ?? 0).toLocaleString(i18n.language);

  return (
    <article className={`${shared.card} ${shared.cardLift} ${styles.card}`}>
      <div className={styles.media}>
        {image ? (
          <img src={image} alt="" className={styles.photo} loading="lazy" decoding="async" />
        ) : (
          <span className={styles.noPhoto} aria-hidden="true">
            <BookOpen size={28} />
          </span>
        )}
        <span className={styles.shade} aria-hidden="true" />
        {desktop ? (
          <>
            {destination ? <span className={styles.chip}>{destination}</span> : null}
            <span className={styles.byline}>
              <span className={styles.byAuthor}>
                <span className={styles.byAvatar}>{initial}</span>
                {author}
              </span>
              <span>{relativeTime(post.created_at, i18n.language)}</span>
            </span>
          </>
        ) : (
          <span className={styles.mediaFoot}>
            {destination ? <span className={styles.chipDark}>{destination}</span> : <span />}
            <span className={styles.mStats}>
              <span className={styles.stat}>
                <Heart size={14} aria-hidden="true" /> {post.like_count.toLocaleString(i18n.language)}
              </span>
              <span className={styles.stat}>
                <Bookmark size={14} aria-hidden="true" /> {bookmarks}
              </span>
            </span>
          </span>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link to={`/community/post/${post.id}`} className={styles.stretch}>
            {title}
          </Link>
        </h3>
        {desktop ? (
          <div className={styles.statsBand}>
            <span className={styles.stat}>
              <Heart size={16} aria-hidden="true" className={styles.heart} /> {post.like_count.toLocaleString(i18n.language)}
            </span>
            <span className={styles.stat}>
              <MessageCircle size={16} aria-hidden="true" /> {post.comment_count.toLocaleString(i18n.language)}
            </span>
            <span className={styles.stat}>
              <Bookmark size={16} aria-hidden="true" /> {bookmarks}
            </span>
            {canCopy ? (
              <Link to={`/community/post/${post.id}/trip`} className={styles.copyLink}>
                <Copy size={14} aria-hidden="true" />
                {t('page.stories.copy')}
              </Link>
            ) : null}
          </div>
        ) : (
          <div className={styles.mFoot}>
            <span className={styles.mAuthor}>
              <span className={styles.mAvatar}>{initial}</span>
              {author}
            </span>
            <span className={styles.mLikes}>
              <Heart size={13} aria-hidden="true" /> {post.like_count.toLocaleString(i18n.language)}
            </span>
            {canCopy ? (
              <Link to={`/community/post/${post.id}/trip`} className={styles.mCopy}>
                {t('page.stories.copy')}
                <Copy size={14} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </article>
  );
}

function EmptyStories({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation('home');
  const requireLogin = useRequireLogin();
  return (
    <div className={`${shared.card} ${shared.emptyCard}`}>
      <span className={shared.emptyIcon}>
        <BookOpen size={24} aria-hidden="true" />
      </span>
      <h3 className={shared.emptyTitle}>{t('page.stories.emptyTitle')}</h3>
      <p className={shared.emptyDesc}>{t('page.stories.emptyDesc')}</p>
      {desktop ? null : (
        <Link to="/community/compose" className={`${shared.primaryBtn} ${shared.emptyBtn}`} onClick={requireLogin}>
          <NotebookPen size={18} aria-hidden="true" />
          <span>{t('page.stories.write')}</span>
        </Link>
      )}
    </div>
  );
}

/** "인기 여행기" — 최근 30일 좋아요 많은 공개 글. 글이 없으면 빈 상태 카드 */
export function StoriesSection({ desktop }: { desktop: boolean }) {
  const { t } = useTranslation('home');
  const { user } = useSession();
  const navigate = useNavigate();
  const requireLogin = useRequireLogin();
  const trackRef = useRef<HTMLDivElement>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const { data, isLoading } = usePopularPosts({ limit: PC_LIMIT, viewerId: user?.id ?? null });
  const posts = (data ?? []).slice(0, desktop ? PC_LIMIT : MOBILE_LIMIT);

  function scroll(direction: -1 | 1) {
    const el = trackRef.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth, behavior: 'smooth' });
  }

  return (
    <section className={shared.section} aria-labelledby="home-stories-title">
      <div className={shared.head}>
        <div className={shared.headText}>
          {desktop ? <div className={shared.eyebrow}>{t('page.stories.eyebrow')}</div> : null}
          <h2 id="home-stories-title" className={shared.title}>
            {desktop ? t('page.stories.title') : t('page.stories.titleMobile')}
          </h2>
          {desktop ? null : <p className={shared.sub}>{t('page.stories.eyebrow')}</p>}
        </div>
        {desktop ? (
          <div className={styles.arrows}>
            <button type="button" className={styles.arrow} onClick={() => scroll(-1)} disabled={posts.length <= 4} aria-label={t('page.stories.prev')}>
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button type="button" className={styles.arrow} onClick={() => scroll(1)} disabled={posts.length <= 4} aria-label={t('page.stories.next')}>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <Link to="/community" className={shared.moreLink}>
            {t('page.more')}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className={styles.track}>
          {Array.from({ length: desktop ? 4 : 2 }, (_, i) => (
            <div key={i} className={`${shared.card} ${styles.card}`}>
              <Skeleton height={desktop ? '300px' : '280px'} />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyStories desktop={desktop} />
      ) : (
        <div ref={trackRef} className={styles.track}>
          {posts.map((post) => (
            <StoryCard key={post.id} post={post} desktop={desktop} />
          ))}
        </div>
      )}

      {desktop ? (
        <div className={`${shared.card} ${styles.banner}`}>
          <div className={styles.bannerMain}>
            <span className={styles.bannerIcon}>
              <NotebookPen size={26} aria-hidden="true" />
            </span>
            <div>
              <div className={styles.bannerTitle}>{t('page.stories.bannerTitle')}</div>
              <div className={styles.bannerDesc}>{t('page.stories.bannerDesc')}</div>
            </div>
          </div>
          <button type="button" className={shared.moreLink} onClick={() => setGuideOpen(true)}>
            {t('page.stories.bannerCta')}
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {guideOpen ? (
        <WritingGuideDialog
          onClose={() => setGuideOpen(false)}
          onWrite={() => {
            setGuideOpen(false);
            if (requireLogin()) navigate('/community/compose');
          }}
        />
      ) : null}
    </section>
  );
}
