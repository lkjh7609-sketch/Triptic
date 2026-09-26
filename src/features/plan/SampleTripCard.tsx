import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { normalizeLocale } from '@/shared/i18n';
import {
  SAMPLE_TRIP_CITY,
  SAMPLE_TRIP_END,
  SAMPLE_TRIP_ID,
  SAMPLE_TRIP_START,
  getSampleTripPlaceCount,
  getSampleTripTitle,
} from './sampleTrip';
import cardStyles from './TripCard.module.css';
import styles from './SampleTripCard.module.css';


/**
 * 비로그인 상태 로비에 노출하는 추천 샘플 여행 카드 (index.html renderLobby의
 * sample-project-card 이식, 2026-09-21 기준 라인 4254~4304). 로그인 유도 대신 —
 * 또는 그와 나란히 — 실제 편집 화면을 그대로 체험해볼 수 있게 한다.
 */
export function SampleTripCard() {
  const { t, i18n } = useTranslation(['plan']);
  const placeCount = getSampleTripPlaceCount();
  return (
    <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={`${cardStyles.card} ${styles.card}`}>
      <div className={cardStyles.header}>
        <h3 className={cardStyles.title}>{getSampleTripTitle(normalizeLocale(i18n.language))}</h3>
        <span className={styles.badge}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Sparkles size={16} /></span> {t('sampleTrip.badge')}</span>
      </div>
      <p className={cardStyles.dates}>
        {SAMPLE_TRIP_START} ~ {SAMPLE_TRIP_END} · {t('sampleTrip.duration', { nights: 3, days: 4 })}
      </p>
      <div className={cardStyles.chips}>
        <span className={cardStyles.chip}>{SAMPLE_TRIP_CITY}</span>
        <span className={cardStyles.chip}>{t('sampleTrip.placeCount', { count: placeCount })}</span>
      </div>
      <span className={styles.openLink}>{t('sampleTrip.openLink')} →</span>
    </Link>
  );
}
