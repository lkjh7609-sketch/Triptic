import type { PlaceItem } from './types';
import styles from './ItineraryItemCard.module.css';

interface ItineraryItemCardProps {
  index: number;
  item: PlaceItem;
  onClick?: () => void;
}

/**
 * 일정 항목 카드 (01-design-system.md §6.2)
 * 좌측 번호 마커(28px, --marker-fill) + 시간(브랜드색) + 이름(headline) + 메모.
 * 탭 → 상세 시트. 날씨(우측 아이콘·기온)는 Phase 3(날씨 연동)에서 추가한다.
 */
export function ItineraryItemCard({ index, item, onClick }: ItineraryItemCardProps) {
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
    </button>
  );
}
