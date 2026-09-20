import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '@/shared/api/googleMapsLoader';

/** 컨테이너 엘리먼트에 Google Maps 인스턴스를 생성하고 로드 상태를 반환한다 */
export function useGoogleMap(center: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(() => {
      if (cancelled || !containerRef.current) return;
      const instance = new google.maps.Map(containerRef.current, {
        center,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
      });
      setMap(instance);
    });
    return () => {
      cancelled = true;
    };
    // center는 최초 1회만 사용 (지도 재생성 방지) — 이후 이동은 map.panTo 등으로 호출부가 직접 제어
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { containerRef, map };
}
