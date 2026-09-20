import { mapConditionCode, weatherIcon } from '@/features/weather/conditionMap';
import { formatTemp } from '@/features/weather/weatherRules';
import type { PlaceItem } from './types';
import styles from './ItineraryItemCard.module.css';

interface ItineraryItemCardProps {
  index: number;
  item: PlaceItem;
  onClick?: () => void;
  /** 항목 시각에 가장 가까운 시간별 기온(05-weather.md §6.2) — 없으면(오늘·내일이
   * 아니거나 조회 실패) 렌더링하지 않는다. isDaylight는 hourly 응답에 없어 항상 주간
   * 아이콘을 쓴다(사소한 시각적 근사 — 값 자체의 정확도와는 무관). */
  weather?: { tempC: number; conditionCode: string } | null;
}

/**
 * 일정 항목 카드 (01-design-system.md §6.2)
 * 좌측 번호 마커(28px, --marker-fill) + 시간(브랜드색) + 이름(headline) + 메모.
 * 탭 → 상세 시트. 우측에 항목 시각의 시간별 기온(05-weather.md §6.2)을 보여준다.
 */
export function ItineraryItemCard({ index, item, onClick, weather }: ItineraryItemCardProps) {
  const tempText = weather ? formatTemp(weather.tempC) : null;
  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <div className={styles.marker} aria-hidden="true">
        {index + 1}
      </div>
      <div className={styles.body}>
        <div className={styles.topRow}>
          {item.time ? <span className={styles.time}>{item.time}</span> : null}
        </div>
        <p className={styles.name}>{item.name}</p>
        {item.memo ? <p className={styles.memo}>🔍 {item.memo}</p> : null}
      </div>
      {weather && tempText ? (
        <div className={styles.weather} aria-hidden="true">
          <span className={styles.weatherIcon}>{weatherIcon(mapConditionCode(weather.conditionCode), true)}</span>
          <span className={styles.weatherTemp}>{tempText}</span>
        </div>
      ) : null}
    </button>
  );
}
