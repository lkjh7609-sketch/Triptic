import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { formatMoney } from './hotelsApi';
import type { HotelFacets } from './useHotelResults';
import styles from './HotelFilters.module.css';

/** 서버가 걸러 주는 조건만 — 성급(이상)·리뷰 점수(이상)·가격 상한·할인 상품만 */
export interface HotelFilterState {
  minStars: number | null;
  minReview: number | null;
  maxPrice: number | null;
  discountOnly: boolean;
}

export const NO_FILTERS: HotelFilterState = { minStars: null, minReview: null, maxPrice: null, discountOnly: false };

export function activeFilterCount(f: HotelFilterState): number {
  return (f.minStars !== null ? 1 : 0) + (f.minReview !== null ? 1 : 0) + (f.maxPrice !== null ? 1 : 0) + (f.discountOnly ? 1 : 0);
}

const STARS = [3, 4, 5] as const;
const REVIEWS = [7, 8, 9] as const;

function PriceSlider({ facets, value, currency, onChange }: { facets: HotelFacets; value: number | null; currency: string; onChange: (v: number | null) => void }) {
  const { t, i18n } = useTranslation('home');
  const min = Math.floor(facets.priceMin);
  const max = Math.ceil(facets.priceMax);
  // 슬라이더를 끄는 동안만 draft를 들고(null이면 적용된 값을 따른다), 멈추면 적용
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value ?? max;
  useEffect(() => {
    if (draft === null) return;
    const id = window.setTimeout(() => {
      onChange(draft >= max ? null : draft);
      setDraft(null);
    }, 450);
    return () => window.clearTimeout(id);
  }, [draft, max, onChange]);
  if (max <= min) return null;
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{t('hotels.filters.price')}</legend>
      <input
        className={styles.range}
        type="range"
        min={min}
        max={max}
        step={Math.max(1, Math.round((max - min) / 100))}
        value={shown}
        aria-label={t('hotels.filters.price')}
        aria-valuetext={formatMoney(shown, currency, i18n.language)}
        onChange={(e) => setDraft(Number(e.target.value))}
      />
      <div className={styles.rangeLabels}>
        <span>{formatMoney(min, currency, i18n.language)}</span>
        <strong>{shown >= max ? t('hotels.filters.anyPrice') : t('hotels.filters.upTo', { price: formatMoney(shown, currency, i18n.language) })}</strong>
        <span>{formatMoney(max, currency, i18n.language)}</span>
      </div>
    </fieldset>
  );
}

/** 필터 목록 — PC는 옆 칸, 모바일은 아래에서 올라오는 시트가 같은 내용을 쓴다 */
export function HotelFilters({
  facets,
  value,
  currency,
  onChange,
}: {
  facets: HotelFacets | null;
  value: HotelFilterState;
  currency: string;
  onChange: (next: HotelFilterState) => void;
}) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.panel}>
      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('hotels.filters.stars')}</legend>
        <div className={styles.pills}>
          <button type="button" aria-pressed={value.minStars === null} className={value.minStars === null ? styles.pillOn : styles.pill} onClick={() => onChange({ ...value, minStars: null })}>
            {t('hotels.filters.anyStars')}
          </button>
          {STARS.map((n) => (
            <button key={n} type="button" aria-pressed={value.minStars === n} className={value.minStars === n ? styles.pillOn : styles.pill} onClick={() => onChange({ ...value, minStars: value.minStars === n ? null : n })}>
              <Star size={12} fill="currentColor" aria-hidden="true" /> {t('hotels.filters.starsOver', { n })}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('hotels.filters.rating')}</legend>
        <div className={styles.pills}>
          <button type="button" aria-pressed={value.minReview === null} className={value.minReview === null ? styles.pillOn : styles.pill} onClick={() => onChange({ ...value, minReview: null })}>
            {t('hotels.filters.anyRating')}
          </button>
          {REVIEWS.map((r) => (
            <button key={r} type="button" aria-pressed={value.minReview === r} className={value.minReview === r ? styles.pillOn : styles.pill} onClick={() => onChange({ ...value, minReview: value.minReview === r ? null : r })}>
              {t('hotels.filters.ratingOver', { n: r })}
            </button>
          ))}
        </div>
      </fieldset>

      {facets ? <PriceSlider facets={facets} value={value.maxPrice} currency={currency} onChange={(maxPrice) => onChange({ ...value, maxPrice })} /> : null}

      <fieldset className={styles.group}>
        <label className={styles.check}>
          <input type="checkbox" checked={value.discountOnly} onChange={() => onChange({ ...value, discountOnly: !value.discountOnly })} />
          <span className={styles.checkText}>{t('hotels.filters.discountOnly')}</span>
        </label>
      </fieldset>
    </div>
  );
}
