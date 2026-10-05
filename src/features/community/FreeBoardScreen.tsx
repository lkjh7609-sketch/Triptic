import { MessagesSquare, PenLine, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ChannelPostCard } from './channel/ChannelPostCard';
import { useChannelPosts } from './hooks/useDestinationChannel';
import type { PostSort } from './communityService';
import styles from './DestinationChannelScreen.module.css';
import boardStyles from './FreeBoardScreen.module.css';

const SEARCH_DEBOUNCE_MS = 350;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

/**
 * 자유게시판 (/community/board) — 도시와 상관없이 쓴 글(posts.destination_id가 비어 있는 글)만 모은다.
 * 도시 채널과 같은 모양(분류 탭·검색·정렬·글 카드)에서 도시 머리말·환율·날씨 같은 도시 전용 칸만 뺐다.
 */
export function FreeBoardScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const requireLogin = useRequireLogin();
  const [draft, setDraft] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<PostSort>('latest');
  const search = useDebounced(draft.trim(), SEARCH_DEBOUNCE_MS);

  useEffect(() => {
    trackScreenView('community_free_board');
  }, []);

  const feed = useChannelPosts({
    destinationId: undefined,
    freeBoard: true,
    viewerId: user?.id ?? null,
    search,
    sort,
    tag: tag || undefined,
  });
  const items = feed.data?.pages.flatMap((p) => p.posts) ?? [];
  const filterText = search || (tag ? `#${tag}` : '');

  return (
    <div className={styles.page}>
      <div className={`${styles.container} ${boardStyles.head}`}>
        <span className={boardStyles.icon} aria-hidden="true">
          <MessagesSquare size={26} />
        </span>
        <div>
          <p className={boardStyles.crumb}>
            <Link to="/community">{t('detail.breadcrumbCommunity')}</Link>
          </p>
          <h1 className={boardStyles.title}>{t('board.free')}</h1>
          <p className={boardStyles.sub}>{t('board.subtitle')}</p>
        </div>
      </div>

      <div className={`${styles.container} ${styles.body}`}>
        <div className={styles.toolbar}>
          <div className={styles.tools}>
            <label className={styles.search}>
              <Search size={18} aria-hidden="true" className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                value={draft}
                placeholder={t('board.searchPlaceholder')}
                aria-label={t('board.searchPlaceholder')}
                onChange={(e) => setDraft(e.target.value)}
              />
              {draft ? (
                <button type="button" className={styles.searchClear} aria-label={t('channel.searchClear')} onClick={() => setDraft('')}>
                  <X size={16} aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <select className={styles.sort} value={sort} aria-label={t('channel.sortAria')} onChange={(e) => setSort(e.target.value as PostSort)}>
              {(['latest', 'popular', 'comments'] as const).map((key) => (
                <option key={key} value={key}>
                  {t(`channel.sort.${key}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <main className={boardStyles.feed}>
          {tag ? (
            <div className={styles.tagFilter} role="status">
              <span>{t('channel.tagFilter', { tag })}</span>
              <button type="button" className={styles.tagFilterClear} onClick={() => setTag('')}>
                {t('channel.tagFilterClear')}
              </button>
            </div>
          ) : null}
          {feed.isLoading ? (
            <>
              <Skeleton height="140px" />
              <Skeleton height="140px" />
            </>
          ) : feed.isError ? (
            <ErrorState summary={t('feed.loadError')} onRetry={() => feed.refetch()} />
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <h3>{filterText ? t('channel.searchEmpty', { query: filterText }) : t('board.empty')}</h3>
              {filterText ? (
                <button type="button" className={styles.emptyCta} onClick={() => { setDraft(''); setTag(''); }}>
                  {t('channel.searchClear')}
                </button>
              ) : (
                <>
                  <p>{t('feed.emptySub')}</p>
                  <Link to="/community/compose?board=free" className={styles.emptyCta} onClick={requireLogin}>
                    {t('feed.writeFirst')}
                  </Link>
                </>
              )}
            </div>
          ) : (
            <>
              {items.map((post) => (
                <ChannelPostCard key={post.id} post={post} onTagClick={(name) => { setDraft(''); setTag(name); }} />
              ))}
              {feed.hasNextPage ? (
                <div className={styles.loadMoreWrap}>
                  <button type="button" className={styles.loadMore} onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
                    {feed.isFetchingNextPage ? t('state.loading', { ns: 'common' }) : t('board.loadMore')}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>

      <Link to="/community/compose?board=free" className={styles.fab} onClick={requireLogin}>
        <PenLine size={20} aria-hidden="true" />
        <span>{t('channel.write')}</span>
      </Link>
    </div>
  );
}
