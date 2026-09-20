/**
 * Google Maps 길찾기 딥링크 (index.html에서 이식 — ADR-001)
 * 원본: index.html buildDeepLinkHTML의 URL 생성 부분 (2026-09-20 기준 라인 5660~5679).
 * HTML 문자열 조립은 React 컴포넌트(LegLabel, 01-design-system.md §6.3)가 대신하고,
 * URL 생성 로직만 순수 함수로 분리했다 — URL 포맷 자체는 원본과 동일하다.
 */
import type { GeoPoint } from './geo';

export function buildTransitDeepLinkUrl(origin: GeoPoint, destination: GeoPoint): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=transit`;
}
