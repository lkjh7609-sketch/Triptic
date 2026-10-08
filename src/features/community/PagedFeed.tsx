import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import styles from './PagedFeed.module.css';

/** 한 쪽에 보이는 카드 수 — 전체·구독·동행 피드가 같다 */
export const FEED_PAGE_SIZE = 6;
const MAX_DOTS = 7;

/** PC 쪽 번호 — 처음·끝·지금 쪽 앞뒤 한 칸만 보이고 사이는 줄임표로 접는다 */
export function pageNumbers(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  const keep = new Set([0, total - 1, current - 1, current, current + 1]);
  const out: Array<number | 'gap'> = [];
  let last = -1;
  for (const n of [...keep].filter((n) => n >= 0 && n < total).sort((a, b) => a - b)) {
    if (last >= 0 && n - last > 1) out.push('gap');
    out.push(n);
    last = n;
  }
  return out;
}

/** 모바일 점 — 쪽이 많아도 점은 최대 7개, 지금 쪽을 가운데로 두고 밀린다 */
export function dotWindow(active: number, total: number): { start: number; count: number } {
  const count = Math.min(total, MAX_DOTS);
  const start = Math.max(0, Math.min(active - Math.floor(count / 2), total - count));
  return { start, count };
}

interface PagedFeedProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** 서버에 더 불러올 글이 있는지 — 있으면 끝 쪽에 가까워질 때 미리 불러온다 */
  hasMore: boolean;
  isFetchingMore: boolean;
  fetchMore: () => void;
  /** PC: 한 쪽 안의 배치(예: 2열 격자) */
  gridClassName: string;
  /** 모바일: 한 쪽 안의 배치(예: 세로 목록) */
  listClassName: string;
  /** 한 쪽에 보이는 수 — 기본 6(카드형), 전체 게시판형은 8 */
  pageSize?: number;
  /** PC에서 목록 맨 위에 붙는 머리줄(게시판형의 '제목·작성자…' 줄) */
  gridHeader?: ReactNode;
}

/**
 * 6개씩 끊어 보여 주는 피드.
 * PC는 번호 쪽 넘김, 모바일은 옆으로 밀어 넘기고 아래에 점으로 위치를 보여 준다.
 * 이미 불러온 글을 쪽으로 자를 뿐이고, 서버에서는 지금 쪽이 끝에서 한 쪽 안으로 다가오면 다음 묶음을 미리 불러온다.
 */
export function PagedFeed<T>({ items, getKey, renderItem, hasMore, isFetchingMore, fetchMore, gridClassName, listClassName, pageSize = FEED_PAGE_SIZE, gridHeader }: PagedFeedProps<T>) {
  const { t } = useTranslation('community');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [requested, setRequested] = useState(0);
  const total = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(requested, total - 1);
  const topRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hasMore && !isFetchingMore && page >= total - 2) fetchMore();
  }, [hasMore, isFetchingMore, page, total, fetchMore]);

  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) pages.push(items.slice(i, i + pageSize));

  function goDesktop(next: number) {
    setRequested(next);
    topRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }

  function goMobile(next: number) {
    setRequested(next);
    const el = trackRef.current;
    el?.scrollTo?.({ left: next * el.clientWidth, behavior: 'smooth' });
  }

  function onTrackScroll() {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setRequested((p) => (p === idx ? p : idx));
  }

  if (isDesktop) {
    const current = pages[page] ?? [];
    return (
      <div ref={topRef} className={styles.scrollAnchor}>
        <div className={gridClassName}>
          {gridHeader}
          {current.map((item) => (
            <div key={getKey(item)} className={styles.cell}>
              {renderItem(item)}
            </div>
          ))}
        </div>
        {total > 1 || hasMore ? (
          <nav className={styles.pager} aria-label={t('feed.pager.label')}>
            <button type="button" className={styles.arrow} onClick={() => goDesktop(page - 1)} disabled={page === 0} aria-label={t('feed.pager.prev')}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            {pageNumbers(page, total).map((n, i) =>
              n === 'gap' ? (
                <span key={`gap-${i}`} className={styles.gap} aria-hidden="true">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  className={n === page ? styles.numActive : styles.num}
                  onClick={() => goDesktop(n)}
                  aria-label={t('feed.pager.page', { page: n + 1 })}
                  aria-current={n === page ? 'page' : undefined}
                >
                  {n + 1}
                </button>
              ),
            )}
            {hasMore ? <span className={styles.gap} aria-hidden="true">…</span> : null}
            <button type="button" className={styles.arrow} onClick={() => goDesktop(page + 1)} disabled={page >= total - 1} aria-label={t('feed.pager.next')}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </nav>
        ) : null}
      </div>
    );
  }

  const dots = dotWindow(page, total);
  return (
    <div>
      <div ref={trackRef} className={styles.track} onScroll={onTrackScroll}>
        {pages.map((pageItems, idx) => (
          <div key={idx} className={`${styles.slide} ${listClassName}`}>
            {pageItems.map((item) => (
              <div key={getKey(item)} className={styles.cell}>
                {renderItem(item)}
              </div>
            ))}
          </div>
        ))}
      </div>
      {total > 1 ? (
        <div className={styles.dots} role="group" aria-label={t('feed.pager.label')}>
          {Array.from({ length: dots.count }, (_, i) => dots.start + i).map((n) => (
            <button
              key={n}
              type="button"
              className={n === page ? styles.dotActive : styles.dot}
              onClick={() => goMobile(n)}
              aria-label={t('feed.pager.page', { page: n + 1 })}
              aria-current={n === page ? 'page' : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
