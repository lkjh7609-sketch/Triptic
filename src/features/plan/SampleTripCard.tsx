import { Link } from 'react-router';
import {
  SAMPLE_TRIP_CITY,
  SAMPLE_TRIP_END,
  SAMPLE_TRIP_ID,
  SAMPLE_TRIP_START,
  SAMPLE_TRIP_TITLE,
  getSampleTripPlaceCount,
} from './sampleTrip';
import cardStyles from './TripCard.module.css';
import styles from './SampleTripCard.module.css';

/**
 * 비로그인 상태 로비에 노출하는 추천 샘플 여행 카드 (index.html renderLobby의
 * sample-project-card 이식, 2026-09-21 기준 라인 4254~4304). 로그인 유도 대신 —
 * 또는 그와 나란히 — 실제 편집 화면을 그대로 체험해볼 수 있게 한다.
 */
export function SampleTripCard() {
  const placeCount = getSampleTripPlaceCount();
  return (
    <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={`${cardStyles.card} ${styles.card}`}>
      <div className={cardStyles.header}>
        <h3 className={cardStyles.title}>{SAMPLE_TRIP_TITLE}</h3>
        <span className={styles.badge}>✨ 추천 샘플 일정</span>
      </div>
      <p className={cardStyles.dates}>
        {SAMPLE_TRIP_START} ~ {SAMPLE_TRIP_END} · 3박 4일
      </p>
      <div className={cardStyles.chips}>
        <span className={cardStyles.chip}>{SAMPLE_TRIP_CITY}</span>
        <span className={cardStyles.chip}>장소 {placeCount}곳</span>
      </div>
      <span className={styles.openLink}>일정 보기 →</span>
    </Link>
  );
}
