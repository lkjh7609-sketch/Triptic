import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import {
  DEFAULT_FILTERS,
  MIN_RATINGS,
  PRICE_MAX,
  PRICE_STEP,
  type ActivityFilters,
  type ActivitySort,
} from './activityFilters';
import { useActivityCategories, useActivityPreview } from './useActivityList';
import styles from './ActivityFilterDialog.module.css';

const CLOSE_MS = 200;

function formatKrw(amount: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₩${amount}`;
  }
}

interface ActivityFilterDialogProps {
  /** 마이리얼트립에 보내는 한국어 도시 이름(카테고리·미리보기 조회) */
  cityKo: string;
  /** 모달 제목 옆 배지에 쓰는 화면 언어 도시 이름 */
  cityLabel: string;
  sort: ActivitySort;
  value: ActivityFilters;
  onApply: (filters: ActivityFilters) => void;
  onClose: () => void;
}

/**
 * 상세 필터 — PC는 가운데 창, 모바일은 같은 구성의 하단 시트(DestinationPickerModal 스타일 공유).
 * 바깥 어두운 영역을 눌러도 닫히지 않고 X·Esc로만 닫힌다. "결과 보기"를 눌러야 반영되고 닫으면 버려진다.
 * 아래 버튼의 숫자는 고른 조건으로 미리 조회한 값이다(평점·즉시 확정이 켜져 있으면 받아 둔 목록 안에서 센 값이라 "N개+").
 */
export function ActivityFilterDialog({ cityKo, cityLabel, sort, value, onApply, onClose }: ActivityFilterDialogProps) {
  const { t, i18n } = useTranslation('home');
  const locale = i18n.language;
  const [draft, setDraft] = useState<ActivityFilters>(value);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  function requestClose(after?: () => void) {
    if (closing) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => {
      after?.();
      onClose();
    }, CLOSE_MS);
  }
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  const trapRef = useFocusTrap<HTMLDivElement>(() => requestClose());

  const categories = useActivityCategories(cityKo, true);
  const preview = useActivityPreview({ city: cityKo, sort, draft, enabled: !closing });

  function patch(next: Partial<ActivityFilters>) {
    setDraft((d) => ({ ...d, ...next }));
  }

  const atMax = draft.maxPrice >= PRICE_MAX;
  const priceText = atMax ? `${formatKrw(0, locale)} ~ ${formatKrw(PRICE_MAX, locale)}+` : `${formatKrw(0, locale)} ~ ${formatKrw(draft.maxPrice, locale)}`;
  const fill = `${(draft.maxPrice / PRICE_MAX) * 100}%`;

  const applyLabel =
    preview.count == null
      ? t('activities.filter.apply')
      : t(preview.exact ? 'activities.filter.applyCount' : 'activities.filter.applyCountMore', { count: preview.count });

  const categoryList = categories.data ?? [];

  return createPortal(
    <div className={`${styles.overlay} ${closing ? styles.overlayOut : ''}`}>
      <div
        ref={trapRef}
        className={`${styles.panel} ${styles.wide} ${closing ? styles.panelOut : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-filter-title"
      >
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <h2 id="activity-filter-title" className={styles.title}>
              {t('activities.filter.title')}
            </h2>
            <span className={styles.cityBadge}>{cityLabel}</span>
          </div>
          <button type="button" className={styles.iconBtn} onClick={() => requestClose()} aria-label={t('activities.filter.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          {categoryList.length > 0 ? (
            <section className={styles.group}>
              <h3 className={styles.groupTitle}>{t('activities.filter.category')}</h3>
              <div className={styles.chips} role="group" aria-label={t('activities.filter.category')}>
                <button type="button" className={draft.category === null ? styles.chipOn : styles.chip} aria-pressed={draft.category === null} onClick={() => patch({ category: null })}>
                  {t('activities.filter.categoryAll')}
                </button>
                {categoryList.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={draft.category === c.value ? styles.chipOn : styles.chip}
                    aria-pressed={draft.category === c.value}
                    onClick={() => patch({ category: c.value })}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className={styles.group}>
            <div className={styles.groupHead}>
              <h3 className={styles.groupTitle}>{t('activities.filter.price')}</h3>
              <span className={styles.priceValue}>{priceText}</span>
            </div>
            <div className={styles.sliderBox}>
              <input
                type="range"
                className={styles.slider}
                min={0}
                max={PRICE_MAX}
                step={PRICE_STEP}
                value={draft.maxPrice}
                style={{ '--fill': fill } as React.CSSProperties}
                aria-label={t('activities.filter.price')}
                aria-valuetext={atMax ? t('activities.filter.priceAny') : t('activities.filter.priceRange', { max: formatKrw(draft.maxPrice, locale) })}
                onChange={(e) => patch({ maxPrice: Number(e.target.value) })}
              />
              <div className={styles.scale} aria-hidden="true">
                <span>{formatKrw(0, locale)}</span>
                <span>{formatKrw(PRICE_MAX / 2, locale)}</span>
                <span>{formatKrw(PRICE_MAX, locale)}+</span>
              </div>
            </div>
          </section>

          <section className={styles.group}>
            <h3 className={styles.groupTitle}>{t('activities.filter.rating')}</h3>
            <div className={styles.ratings} role="group" aria-label={t('activities.filter.rating')}>
              {MIN_RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={draft.minRating === r ? styles.ratingOn : styles.rating}
                  aria-pressed={draft.minRating === r}
                  onClick={() => patch({ minRating: r })}
                >
                  {r === 0 ? t('activities.filter.ratingAll') : `★ ${r.toFixed(1)}+`}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.group}>
            <h3 className={styles.groupTitle}>{t('activities.filter.benefits')}</h3>
            <div className={styles.chips} role="group" aria-label={t('activities.filter.benefits')}>
              <button type="button" className={draft.instant ? styles.chipOn : styles.chip} aria-pressed={draft.instant} onClick={() => patch({ instant: !draft.instant })}>
                {t('activities.filter.instant')}
              </button>
              <button
                type="button"
                className={draft.koreanGuide ? styles.chipOn : styles.chip}
                aria-pressed={draft.koreanGuide}
                onClick={() => patch({ koreanGuide: !draft.koreanGuide })}
              >
                {t('activities.filter.koreanGuide')}
              </button>
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.reset} onClick={() => setDraft(DEFAULT_FILTERS)}>
            {t('activities.filter.reset')}
          </button>
          <button type="button" className={styles.apply} onClick={() => requestClose(() => onApply(draft))} aria-live="polite">
            <span>{applyLabel}</span>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
