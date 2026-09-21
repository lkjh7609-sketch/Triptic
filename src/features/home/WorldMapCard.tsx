import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import WorldMap, { type CountryContext, type ISOCode } from 'react-svg-worldmap';
import { countryNameToIso } from './countryLookup';
import styles from './WorldMapCard.module.css';

interface WorldMapCardProps {
  /** get_user_travel_stats_snapshot()의 countries — RPC가 주는 원본 국가명(영문) */
  countries: string[];
}

/**
 * 방문 국가 세계지도 (02-screens.md §2.4)
 * Google Maps 대신 경량 SVG(react-svg-worldmap, 번들에 지도 데이터 포함 — 런타임
 * 네트워크 호출 없음)로 ISO 3166-1 alpha-2 코드 기준 채색한다.
 * 탭하면 해당 국가 여행 목록으로 이동한다는 게 스펙 원문이지만, 계획 탭에
 * 아직 국가별 필터가 없어 이번 라운드는 계획 탭으로만 이동시킨다(후속 작업).
 */
export function WorldMapCard({ countries }: WorldMapCardProps) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
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
      cursor: 'pointer',
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
        onClickFunction={() => navigate('/plan')}
        tooltipTextFunction={(context) => context.countryName}
      />
      <p className={styles.caption}>{t('worldMap.caption', { count: isoCodes.length })}</p>
    </div>
  );
}
