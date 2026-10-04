import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import { formatMoney, type HotelSort, type KayakHotelsResponse } from '@/features/kayak/kayakApi';
import styles from './HotelFilters.module.css';

export interface HotelFilterState {
  stars: number[];
  guestRating: number | null;
  maxPrice: number | null;
  propertyTypes: number[];
  facilities: number[];
}

export const NO_FILTERS: HotelFilterState = { stars: [], guestRating: null, maxPrice: null, propertyTypes: [], facilities: [] };

export function activeFilterCount(f: HotelFilterState): number {
  return f.stars.length + (f.guestRating !== null ? 1 : 0) + (f.maxPrice !== null ? 1 : 0) + f.propertyTypes.length + f.facilities.length;
}

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const RATINGS = [7, 8, 9] as const;
export const HOTEL_SORTS: HotelSort[] = ['popularity', 'price', 'rating', 'stars', 'distance'];

function PriceSlider({ facets, value, currency, onChange }: { facets: KayakHotelsResponse['filters']; value: number | null; currency: string; onChange: (v: number | null) => void }) {
  const { t, i18n } = useTranslation('home');
  const min = Math.floor(facets.priceMin ?? 0);
  const max = Math.ceil(facets.priceMax ?? 0);
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
  facets: KayakHotelsResponse['filters'];
  value: HotelFilterState;
  currency: string;
  onChange: (next: HotelFilterState) => void;
}) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.panel}>
      {facets.stars.length > 0 ? (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('hotels.filters.stars')}</legend>
          {[5, 4, 3, 2, 1]
            .filter((n) => facets.stars.some((s) => s.key === n))
            .map((n) => (
              <label key={n} className={styles.check}>
                <input type="checkbox" checked={value.stars.includes(n)} onChange={() => onChange({ ...value, stars: toggle(value.stars, n) })} />
                <span className={styles.starRow} aria-label={t('hotels.starsN', { count: n })}>
                  {Array.from({ length: n }, (_, i) => (
                    <Star key={i} size={13} fill="currentColor" aria-hidden="true" />
                  ))}
                </span>
                <span className={styles.count}>{facets.stars.find((s) => s.key === n)?.count}</span>
              </label>
            ))}
        </fieldset>
      ) : null}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>{t('hotels.filters.rating')}</legend>
        <div className={styles.pills}>
          <button type="button" aria-pressed={value.guestRating === null} className={value.guestRating === null ? styles.pillOn : styles.pill} onClick={() => onChange({ ...value, guestRating: null })}>
            {t('hotels.filters.anyRating')}
          </button>
          {RATINGS.map((r) => (
            <button key={r} type="button" aria-pressed={value.guestRating === r} className={value.guestRating === r ? styles.pillOn : styles.pill} onClick={() => onChange({ ...value, guestRating: value.guestRating === r ? null : r })}>
              {t('hotels.filters.ratingOver', { n: r })}
            </button>
          ))}
        </div>
      </fieldset>

      <PriceSlider facets={facets} value={value.maxPrice} currency={currency} onChange={(maxPrice) => onChange({ ...value, maxPrice })} />

      {facets.propertyTypes.length > 1 ? (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('hotels.filters.propertyType')}</legend>
          {facets.propertyTypes.map((p) => (
            <label key={p.id} className={styles.check}>
              <input type="checkbox" checked={value.propertyTypes.includes(p.id)} onChange={() => onChange({ ...value, propertyTypes: toggle(value.propertyTypes, p.id) })} />
              <span className={styles.checkText}>{p.name}</span>
              <span className={styles.count}>{p.count}</span>
            </label>
          ))}
        </fieldset>
      ) : null}

      {facets.facilities.length > 0 ? (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('hotels.filters.facilities')}</legend>
          {facets.facilities.map((p) => (
            <label key={p.id} className={styles.check}>
              <input type="checkbox" checked={value.facilities.includes(p.id)} onChange={() => onChange({ ...value, facilities: toggle(value.facilities, p.id) })} />
              <span className={styles.checkText}>{p.name}</span>
              <span className={styles.count}>{p.count}</span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
