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
import { loadGoogleMaps } from '@/shared/api/googleMapsLoader';

export interface RouteWaypoint extends GeoPoint {
  /** dayItems 안에서의 인덱스. 숙소는 'start-hotel' | 'end-hotel', 항공편은 'flight-arrival' | 'flight-departure' */
  ref: number | 'start-hotel' | 'end-hotel' | 'flight-arrival' | 'flight-departure';
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
  /**
   * null이면 실제 렌더링(폴리라인 표시) 없이 구간 거리·시간 정보만 계산한다
   * — 목록 모드에서 LegLabel에 값을 채우는 용도. DirectionsService 자체는
   * 지도 인스턴스 없이도 호출 가능하다(원본과 달리 새로 추가한 동작. 리액트
   * UI에서는 "지도가 화면에 없어도 구간 정보는 필요하다"는 경우가 있기 때문
   * — 알고리즘 자체(연결 순서·캐시·폴백)는 원본과 동일하다).
   */
  map: google.maps.Map | null;
  /** 그 날의 일정 항목. useMemo로 참조를 안정시켜 전달할 것(매 렌더 재실행 방지) */
  dayItems: T[];
  startHotel: Hotel | null;
  endHotel: Hotel | null;
  /** 존이 여러 개인 날, 현재 보고 있는 존 (01-design-system.md §6.4 "존 전환 칩") */
  activeZoneIndex: number;
  /** 첫날 항공편 도착 지점 (index.html renderList flightArrivalPoint) — 여정 맨 앞에 연결된다 */
  flightArrival?: GeoPoint | null;
  /** 마지막날 항공편 출발 지점 (index.html renderList flightDeparturePoint) — 여정 맨 끝에 연결된다 */
  flightDeparture?: GeoPoint | null;
}

/** 세션 동안 유지되는 구간 캐시 — 동일 구간 중복 호출 방지 (패리티 체크리스트 항목).
 * PDF 내보내기(pdfExport.ts)가 legacy exportToPDF의 getTransitToNext처럼 이미
 * 계산된 구간 소요시간을 재사용하려고 export한다 — 방문한 적 없는 날의 구간은
 * 캐시가 비어 있을 수 있고, 그 경우 legacy와 동일하게 이동 정보 없이 표시된다. */
export const sharedDirectionsCache = new DirectionsCache();

export function useTripRoutes<T extends GeoPoint>({
  map,
  dayItems,
  startHotel,
  endHotel,
  activeZoneIndex,
  flightArrival,
  flightDeparture,
}: UseTripRoutesOptions<T>): RouteLeg[] {
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const renderersRef = useRef<google.maps.DirectionsRenderer[]>([]);
  const fallbackPolylinesRef = useRef<google.maps.Polyline[]>([]);
  const [legs, setLegs] = useState<RouteLeg[]>([]);

  useEffect(() => {
    let cancelled = false;

    const clearRoutes = () => {
      renderersRef.current.forEach((r) => r.setMap(null));
      renderersRef.current = [];
      fallbackPolylinesRef.current.forEach((p) => p.setMap(null));
      fallbackPolylinesRef.current = [];
    };

    loadGoogleMaps().then(() => {
      if (cancelled) return;
      runRouteCalculation();
    });

    function runRouteCalculation() {
      clearRoutes();

      const dayZones = computeDayZones(dayItems);
      const multiZone = dayZones.length > 1;
      const activeIndices = multiZone
        ? new Set(dayZones[Math.min(activeZoneIndex, dayZones.length - 1)].indices)
        : null;

      const list: RouteWaypoint[] = [];
      if (flightArrival) {
        list.push({ lat: flightArrival.lat, lng: flightArrival.lng, ref: 'flight-arrival' });
      }
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
      if (flightDeparture) {
        list.push({ lat: flightDeparture.lat, lng: flightDeparture.lng, ref: 'flight-departure' });
      }

      if (list.length < 2) {
        setLegs([]);
        return;
      }

      if (!directionsServiceRef.current) {
        directionsServiceRef.current = new google.maps.DirectionsService();
      }
      const directionsService = directionsServiceRef.current;

      const initialLegs: RouteLeg[] = [];
      for (let i = 0; i < list.length - 1; i++) {
        initialLegs.push({
          from: list[i],
          to: list[i + 1],
          status: 'loading',
          distanceText: null,
          durationText: null,
        });
      }
      setLegs(initialLegs);

      const drawDashedFallback = (origin: GeoPoint, destination: GeoPoint) => {
        if (!map) return;
        const line = new google.maps.Polyline({
          path: [origin, destination],
          strokeOpacity: 0,
          icons: [
            { icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '10px' },
          ],
          strokeColor: '#1E3A5F',
          map,
        });
        fallbackPolylinesRef.current.push(line);
      };

      const patchLeg = (index: number, patch: Partial<RouteLeg>) => {
        if (cancelled) return;
        setLegs((prev) => prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)));
      };

      for (let i = 0; i < list.length - 1; i++) {
        const origin = list[i];
        const destination = list[i + 1];

        const renderer = map
          ? new google.maps.DirectionsRenderer({
              map,
              suppressMarkers: true,
              preserveViewport: true,
              polylineOptions: { strokeColor: '#2563EB', strokeWeight: 4, strokeOpacity: 0.85 },
            })
          : null;
        if (renderer) renderersRef.current.push(renderer);

        const cached = sharedDirectionsCache.get(origin, destination);
        if (cached) {
          if (cached.status === 'OK') {
            renderer?.setDirections(cached.result);
            patchLeg(i, { status: 'ok', distanceText: cached.distance, durationText: cached.duration });
          } else {
            renderer?.setMap(null);
            drawDashedFallback(origin, destination);
            patchLeg(i, { status: 'estimate' });
          }
          continue;
        }

        directionsService.route(
          { 
            origin, 
            destination, 
            travelMode: google.maps.TravelMode.TRANSIT,
            provideRouteAlternatives: true
          },
          (result, status) => {
            if (status === 'OK' && result?.routes && result.routes.length > 0) {
              // 대중교통(TRANSIT) 스텝이 하나라도 포함된 경로들 먼저 필터링
              const transitRoutes = result.routes.filter(route => 
                route.legs.some(leg => 
                  leg.steps.some(step => step.travel_mode === 'TRANSIT')
                )
              );

              // 대중교통 경로가 하나도 없으면 전체 경로 중 선택 (보통 이 경우는 도보만 있는 경우임)
              const candidateRoutes = transitRoutes.length > 0 ? transitRoutes : result.routes;

              // 후보 경로들 중에서 최단 시간 경로 찾기
              let bestRoute = candidateRoutes[0];
              let minDuration = bestRoute.legs[0]?.duration?.value ?? Infinity;

              for (const route of candidateRoutes) {
                const duration = route.legs[0]?.duration?.value;
                if (duration != null && duration < minDuration) {
                  minDuration = duration;
                  bestRoute = route;
                }
              }

              // 렌더러가 여러 경로 중 우리가 선택한 하나만 그리도록 조작
              const bestResult = { ...result, routes: [bestRoute] };

              renderer?.setDirections(bestResult);
              const leg = bestRoute.legs[0];
              const durationText = leg ? leg.duration!.text : '';
              const distanceText = leg ? leg.distance!.text : '';
              sharedDirectionsCache.setHit(origin, destination, bestResult, durationText, distanceText);
              patchLeg(i, { status: 'ok', distanceText, durationText });
            } else {
              renderer?.setMap(null);
              sharedDirectionsCache.setMiss(origin, destination);
              drawDashedFallback(origin, destination);
              patchLeg(i, { status: 'estimate' });
            }
          },
        );
      }
    }

    return () => {
      cancelled = true;
      clearRoutes();
    };
    // dayItems/startHotel/endHotel은 얕은 비교이므로, 호출부에서 useMemo 등으로
    // 참조를 안정시켜야 불필요한 재실행(경로 재호출)을 피할 수 있다.
  }, [map, dayItems, startHotel, endHotel, activeZoneIndex, flightArrival, flightDeparture]);

  return legs;
}
