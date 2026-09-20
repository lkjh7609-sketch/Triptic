/**
 * 하루 일정의 구간별 경로를 그린다 (index.html에서 이식 — ADR-001)
 * 원본: index.html drawRoutesForViewMode/drawDashedFallback/clearRoutes
 * (2026-09-20 기준 라인 7035~7144).
 *
 * ⚠️ 이 앱의 핵심 차별점이다 — 알고리즘을 바꾸지 않았다:
 * 1) 존 분리된 하루는 활성 존에 속한 항목만 연결한다
 * 2) 전날 숙소 → (활성 존 항목들) → 당일 숙소 순서로 연결한다
 * 3) 구간마다 DirectionsService(TRANSIT)를 캐시 우선으로 호출한다
 * 4) 실패하면 점선 폴리라인으로 대체한다 (조용히 사라지지 않는다)
 */
import { useEffect, useRef, useState } from 'react';
import { computeDayZones, nearestZoneIndexForPoint, type GeoPoint } from './geo';
import { DirectionsCache } from './directionsCache';
import type { Hotel } from './hotels';

export interface RouteWaypoint extends GeoPoint {
  /** dayItems 안에서의 인덱스. 숙소는 'start-hotel' | 'end-hotel' */
  ref: number | 'start-hotel' | 'end-hotel';
}

export interface RouteLeg {
  from: RouteWaypoint;
  to: RouteWaypoint;
  /** 아직 DirectionsService 응답을 기다리는 중 (LegLabel 스켈레톤용) */
  status: 'loading' | 'ok' | 'estimate';
  distanceText: string | null;
  durationText: string | null;
}

interface UseTripRoutesOptions<T extends GeoPoint> {
  map: google.maps.Map | null;
  /** 그 날의 일정 항목. useMemo로 참조를 안정시켜 전달할 것(매 렌더 재실행 방지) */
  dayItems: T[];
  startHotel: Hotel | null;
  endHotel: Hotel | null;
  /** 존이 여러 개인 날, 현재 보고 있는 존 (01-design-system.md §6.4 "존 전환 칩") */
  activeZoneIndex: number;
}

/** 세션 동안 유지되는 구간 캐시 — 동일 구간 중복 호출 방지 (패리티 체크리스트 항목) */
const sharedDirectionsCache = new DirectionsCache();

export function useTripRoutes<T extends GeoPoint>({
  map,
  dayItems,
  startHotel,
  endHotel,
  activeZoneIndex,
}: UseTripRoutesOptions<T>): RouteLeg[] {
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const renderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const fallbackPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [legs, setLegs] = useState<RouteLeg[]>([]);

  useEffect(() => {
    if (!map) return;

    // clearRoutes (원본 그대로)
    renderersRef.current.forEach((r) => r.setMap(null));
    renderersRef.current = [];
    fallbackPolylinesRef.current.forEach((p) => p.setMap(null));
    fallbackPolylinesRef.current = [];

    const dayZones = computeDayZones(dayItems);
    const multiZone = dayZones.length > 1;
    const activeIndices = multiZone
      ? new Set(dayZones[Math.min(activeZoneIndex, dayZones.length - 1)].indices)
      : null;

    const list: RouteWaypoint[] = [];
    if (
      startHotel &&
      (!multiZone ||
        nearestZoneIndexForPoint(dayZones, dayItems, startHotel) === activeZoneIndex)
    ) {
      list.push({ lat: startHotel.lat, lng: startHotel.lng, ref: 'start-hotel' });
    }
    dayItems.forEach((p, idx) => {
      if (p.lat == null || p.lng == null) return;
      if (multiZone && !activeIndices!.has(idx)) return;
      list.push({ lat: p.lat, lng: p.lng, ref: idx });
    });
    if (
      endHotel &&
      (!multiZone || nearestZoneIndexForPoint(dayZones, dayItems, endHotel) === activeZoneIndex)
    ) {
      list.push({ lat: endHotel.lat, lng: endHotel.lng, ref: 'end-hotel' });
    }

    if (list.length < 2) {
      // 외부 시스템(Directions API) 응답으로 채워지는 상태를 "연결할 구간 없음"으로
      // 동기화하는 것 — 파생 가능한 렌더 상태가 아니라 effect의 정상 책임이다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLegs([]);
      return;
    }

    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }
    const directionsService = directionsServiceRef.current;

    const initialLegs: RouteLeg[] = [];
    for (let i = 0; i < list.length - 1; i++) {
      initialLegs.push({ from: list[i], to: list[i + 1], status: 'loading', distanceText: null, durationText: null });
    }
    setLegs(initialLegs);

    const drawDashedFallback = (origin: GeoPoint, destination: GeoPoint) => {
      const line = new google.maps.Polyline({
        path: [origin, destination],
        strokeOpacity: 0,
        icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '10px' }],
        strokeColor: '#1E3A5F',
        map,
      });
      fallbackPolylinesRef.current.push(line);
    };

    const patchLeg = (index: number, patch: Partial<RouteLeg>) => {
      setLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)));
    };

    for (let i = 0; i < list.length - 1; i++) {
      const origin = list[i];
      const destination = list[i + 1];

      const renderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        preserveViewport: true,
        polylineOptions: { strokeColor: '#2563EB', strokeWeight: 4, strokeOpacity: 0.85 },
      });
      renderersRef.current.push(renderer);

      const cached = sharedDirectionsCache.get(origin, destination);
      if (cached) {
        if (cached.status === 'OK') {
          renderer.setDirections(cached.result);
          patchLeg(i, { status: 'ok', distanceText: cached.distance, durationText: cached.duration });
        } else {
          renderer.setMap(null);
          drawDashedFallback(origin, destination);
          patchLeg(i, { status: 'estimate' });
        }
        continue;
      }

      directionsService.route(
        { origin, destination, travelMode: google.maps.TravelMode.TRANSIT },
        (result, status) => {
          if (status === 'OK' && result?.routes?.[0]) {
            renderer.setDirections(result);
            const leg = result.routes[0].legs[0];
            const durationText = leg ? leg.duration!.text : '';
            const distanceText = leg ? leg.distance!.text : '';
            sharedDirectionsCache.setHit(origin, destination, result, durationText, distanceText);
            patchLeg(i, { status: 'ok', distanceText, durationText });
          } else {
            renderer.setMap(null);
            sharedDirectionsCache.setMiss(origin, destination);
            drawDashedFallback(origin, destination);
            patchLeg(i, { status: 'estimate' });
          }
        },
      );
    }

    return () => {
      renderersRef.current.forEach((r) => r.setMap(null));
      renderersRef.current = [];
      fallbackPolylinesRef.current.forEach((p) => p.setMap(null));
      fallbackPolylinesRef.current = [];
    };
    // dayItems/startHotel/endHotel은 얕은 비교이므로, 호출부에서 useMemo 등으로
    // 참조를 안정시켜야 불필요한 재실행(경로 재호출)을 피할 수 있다.
  }, [map, dayItems, startHotel, endHotel, activeZoneIndex]);

  return legs;
}
