import { useTranslation } from 'react-i18next';
import { mapConditionCode, weatherIcon } from '@/features/weather/conditionMap';
import { formatTemp } from '@/features/weather/weatherRules';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import type { PlaceItem } from './types';
import styles from './ItineraryItemCard.module.css';
import { Search, Sparkles, Ticket } from 'lucide-react';
import { openKlookSearch } from './partnerLinks';

interface ItineraryItemCardProps {
  index: number;
  item: PlaceItem;
  onClick?: () => void;
  onAiSuggest?: () => void;
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
export function ItineraryItemCard({ index, item, onClick, onAiSuggest, weather }: ItineraryItemCardProps) {
  const { t, i18n } = useTranslation('plan');
  const tempUnit = useTempUnit();
  // 관광지(명소·박물관·테마파크 등)만 — 공항·숙소·식당엔 티켓이 없다
  const showTicket = item.category === 'sight';
  const tempText = weather ? formatTemp(weather.tempC, tempUnit) : null;
  return (
    <div className={styles.cardWrap}>
      <button type="button" className={styles.card} onClick={onClick}>
        <div className={styles.markerWrap} aria-hidden="true">
          <div className={styles.marker}>{index + 1}</div>
          <div className={styles.connectingLine} />
        </div>
        <div className={styles.body}>
          <div className={styles.topRow}>
            {item.time ? <span className={styles.time}>{item.time}</span> : null}
          </div>
          <p className={styles.name}>{item.name}</p>
          {item.memo ? <p className={styles.memo}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Search size={16} /> {item.memo}</span></p> : null}
        </div>
        {weather && tempText ? (
          <div className={styles.weather} aria-hidden="true">
            <span className={styles.weatherIcon}>{weatherIcon(mapConditionCode(weather.conditionCode), true)}</span>
            <span className={styles.weatherTemp}>{tempText}</span>
          </div>
        ) : null}
      </button>
      {showTicket || onAiSuggest ? (
        <div className={styles.cornerActions}>
          {showTicket ? (
            <button
              type="button"
              className={styles.cornerBtn}
              // 카드 열기/드래그와 겹치지 않게(AI 추천 버튼과 같은 방식). Klook에서 장소 이름으로
              // 검색한 결과(제휴 링크)를 새 탭으로 — 누르는 즉시 탭을 열어 iOS 차단을 피한다
              onClick={(e) => { e.stopPropagation(); void openKlookSearch(item.name, i18n.language, 'ticket'); }}
              title={t('itinerary.ticketTitle', { place: item.name })}
              aria-label={t('itinerary.ticketTitle', { place: item.name })}
            >
              <Ticket size={14} aria-hidden="true" /> {t('itinerary.ticket')}
            </button>
          ) : null}
          {onAiSuggest ? (
            <button
              type="button"
              className={styles.cornerBtn}
              onClick={(e) => { e.stopPropagation(); onAiSuggest(); }}
              title={t('aiNext.buttonTitle')}
              aria-label={t('aiNext.buttonTitle')}
            >
              <Sparkles size={14} aria-hidden="true" /> {t('aiNext.button')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
