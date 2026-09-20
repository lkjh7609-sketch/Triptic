/**
 * 하루의 항목·숙소 마커를 지도에 그린다 (index.html updateMarkers에서 이식 — ADR-001)
 * 원본: index.html updateMarkers (2026-09-20 기준 라인 6888~6961)의 마커 생성 부분.
 * 존 필터링을 적용해 활성 존의 항목만 표시하고, 화면에 보이는 지점 전체가
 * 뷰포트에 들어오도록 지도를 자동으로 맞춘다(fitBounds).
 */
import { useEffect, useRef } from 'react';
import { computeDayZones, nearestZoneIndexForPoint, type GeoPoint } from './geo';
import type { Hotel } from './hotels';

interface UseTripMarkersOptions<T extends GeoPoint> {
  map: google.maps.Map | null;
  dayItems: T[];
  startHotel: Hotel | null;
  endHotel: Hotel | null;
  activeZoneIndex: number;
}

export function useTripMarkers<T extends GeoPoint>({
  map,
  dayItems,
  startHotel,
  endHotel,
  activeZoneIndex,
}: UseTripMarkersOptions<T>) {
  const markersRef = useRef<google.maps.Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const dayZones = computeDayZones(dayItems);
    const multiZone = dayZones.length > 1;
    const activeIndices = multiZone
      ? new Set(dayZones[Math.min(activeZoneIndex, dayZones.length - 1)].indices)
      : null;

    const bounds = new google.maps.LatLngBounds();
    let hasBoundsPoint = false;
    const placedHotelKeys = new Set<string>();

    [startHotel, endHotel].forEach((h) => {
      if (!h) return;
      if (multiZone && nearestZoneIndexForPoint(dayZones, dayItems, h) !== activeZoneIndex) return;
      const key = `${h.lat},${h.lng}`;
      if (placedHotelKeys.has(key)) return;
      placedHotelKeys.add(key);
      const pos = { lat: h.lat, lng: h.lng };
      const marker = new google.maps.Marker({
        map,
        position: pos,
        title: h.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: '#1E3A5F',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
      hasBoundsPoint = true;
    });

    let shownItemCount = 0;
    dayItems.forEach((item, index) => {
      if (item.lat == null || item.lng == null) return;
      if (multiZone && !activeIndices!.has(index)) return;
      shownItemCount++;
      const pos = { lat: item.lat, lng: item.lng };
      const marker = new google.maps.Marker({
        map,
        position: pos,
        label: { text: String(index + 1), color: '#ffffff', fontWeight: 'bold', fontSize: '12px' },
      });
      markersRef.current.push(marker);
      bounds.extend(pos);
      hasBoundsPoint = true;
    });

    const totalPoints = shownItemCount + placedHotelKeys.size;
    if (hasBoundsPoint && totalPoints > 1) {
      map.fitBounds(bounds);
    } else if (hasBoundsPoint) {
      map.setCenter(bounds.getCenter());
      map.setZoom(15);
    }

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, dayItems, startHotel, endHotel, activeZoneIndex]);
}
