/**
 * 날씨 격자 키 (05-weather.md §3.3)
 * 좌표를 소수점 2자리(약 1.1km 격자)로 반올림해 같은 도시 안의 여러 일정이
 * 거의 항상 같은 캐시 키로 묶이도록 한다 — 캐시 적중률을 높여 실제 WeatherKit
 * 호출량을 줄이는 것이 목적(§3.3 "목표: 캐시 적중률 ≥ 80%, 하루 ≤ 10회").
 */
export function gridKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}
