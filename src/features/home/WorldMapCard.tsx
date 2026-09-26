import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import WorldMap, { type CountryContext, type ISOCode } from 'react-svg-worldmap';
import { countryNameToIso } from './countryLookup';
import styles from './WorldMapCard.module.css';

interface WorldMapCardProps {
  /** get_user_travel_stats()의 countries — RPC가 주는 원본 국가명(영문) */
  countries: string[];
}

/**
 * 방문 국가 세계지도 (02-screens.md §2.4)
 * Google Maps 대신 경량 SVG(react-svg-worldmap, 번들에 지도 데이터 포함 — 런타임
 * 네트워크 호출 없음)로 ISO 3166-1 alpha-2 코드 기준 채색한다. 계획 탭 안에서
 * 보여주므로 탭해서 또 계획 탭으로 이동시키는 동작은 없다.
 */
export function WorldMapCard({ countries }: WorldMapCardProps) {
  const { t } = useTranslation('home');
  const isoCodes = useMemo(
    () => Array.from(new Set(countries.map(countryNameToIso).filter((c): c is string => !!c))),
    [countries],
  );
  const data = useMemo(
    () => isoCodes.map((country) => ({ country: country as ISOCode, value: 1 })),
    [isoCodes],
  );

  if (isoCodes.length === 0) return null;

  function styleFunction(context: CountryContext<number>) {
    return {
      fill: context.countryValue ? 'var(--brand)' : 'var(--surface-sunken)',
      stroke: 'var(--surface-card)',
      strokeWidth: 0.5,
      cursor: 'default',
    };
  }

  return (
    <div className={styles.card}>
      <WorldMap
        size="responsive"
        color="var(--brand)"
        backgroundColor="transparent"
        data={data}
        styleFunction={styleFunction}
        tooltipTextFunction={(context) => context.countryName}
      />
      <p className={styles.caption}>{t('worldMap.caption', { count: isoCodes.length })}</p>
    </div>
  );
}
