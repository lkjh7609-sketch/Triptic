import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { TripRow } from '@/shared/api/tripService';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import { mapConditionCode, weatherIcon } from './conditionMap';
import { useWeather } from './useWeather';
import { formatTemp } from './weatherRules';
import styles from './TripWeatherChip.module.css';

interface TripWeatherChipProps {
  trip: Pick<TripRow, 'city_lat' | 'city_lng' | 'start_date' | 'end_date'>;
  className?: string;
}

/**
 * 여행 카드용 날씨 한 칸 — 출발일의 날씨 아이콘 + 최저/최고. 이미 출발한 여행은 오늘 날씨.
 * 여행 상세와 같은 조회(같은 키)라 요청이 늘지 않는다. 날씨가 없으면(날짜·도시 좌표 없음, 서버
 * 실패) 아무것도 그리지 않는다 — 가짜 값을 채우지 않는다(05-weather.md §6.3).
 */
export function TripWeatherChip({ trip, className }: TripWeatherChipProps) {
  const { t } = useTranslation('plan');
  const tempUnit = useTempUnit();
  const weather = useWeather(trip.city_lat, trip.city_lng, trip.start_date, trip.end_date);
  if (!trip.start_date) return null;
  const today = format(new Date(), 'yyyy-MM-dd');
  const day = trip.start_date < today ? today : trip.start_date;
  const entry = weather.data?.daily.find((d) => d.date === day);
  if (!entry) return null;
  const min = formatTemp(entry.tempMinC, tempUnit);
  const max = formatTemp(entry.tempMaxC, tempUnit);
  if (min == null && max == null) return null;
  const icon = entry.conditionCode ? weatherIcon(mapConditionCode(entry.conditionCode), true) : null;
  return (
    <span className={`${styles.chip} ${className ?? ''}`}>
      {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
      {min ?? '–'}/{max ?? '–'}
      {entry.source === 'climate_normal' ? <span className={styles.badge}>{t('tripDetail.climateBadge')}</span> : null}
    </span>
  );
}
