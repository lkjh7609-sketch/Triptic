import { useGoogleMap } from './map/useGoogleMap';
import { useTripRoutes } from './map/useTripRoutes';
import { useTripMarkers } from './map/useTripMarkers';
import type { Hotel } from './map/hotels';
import type { PlaceItem } from './types';
import styles from './TripMapView.module.css';

interface TripMapViewProps {
  dayItems: PlaceItem[];
  startHotel: Hotel | null;
  endHotel: Hotel | null;
  activeZoneIndex: number;
}

const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 }; // 서울시청 — 항목이 없을 때의 폴백 중심

/**
 * 지도 뷰 (02-screens.md §3.3) ⭐ 이 앱의 차별점
 * 번호 핀 + 구간 경로. TRANSIT 실패 시 점선 폴백을 그대로 유지한다.
 * 바텀시트·존 전환 칩·현재 위치 버튼은 후속 라운드에서 추가한다.
 */
export function TripMapView({ dayItems, startHotel, endHotel, activeZoneIndex }: TripMapViewProps) {
  const firstItem = dayItems.find((i) => i.lat != null && i.lng != null);
  const center = firstItem ? { lat: firstItem.lat, lng: firstItem.lng } : DEFAULT_CENTER;
  const { containerRef, map } = useGoogleMap(center);

  useTripRoutes({ map, dayItems, startHotel, endHotel, activeZoneIndex });
  useTripMarkers({ map, dayItems, startHotel, endHotel, activeZoneIndex });

  return <div ref={containerRef} className={styles.map} role="img" aria-label="일정 지도" />;
}
