/**
 * 예보 범위를 넘는 날짜 규칙 + 온도 단위 변환 (05-weather.md §5, §6.1)
 * "이것이 여행 앱에서 날씨를 다룰 때 가장 흔한 버그다" — 예보는 10일치뿐이므로
 * 그 이후 날짜는 반드시 기후 평년값 + "평년" 배지로 구분 표시해야 한다.
 */

/** WeatherKit 일별 예보가 실제로 커버하는 범위(§5.1 "≤ 10일") */
export const FORECAST_RANGE_DAYS = 10;

/**
 * 오늘부터 대상 날짜까지 며칠 남았는지에 따라 예보/평년값 소스를 정한다.
 * 과거 날짜는 평년값이 아니라 실제 관측값(있으면) 대상이므로 이 함수의 대상이 아니다 —
 * 호출부(§5.1 "과거 여행" 행)에서 별도로 처리한다.
 */
export function shouldUseClimateNormal(targetDate: string, today: string): boolean {
  const daysUntil = daysBetween(today, targetDate);
  if (daysUntil < 0) return false; // 과거 — 평년값 규칙 밖
  return daysUntil > FORECAST_RANGE_DAYS;
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00Z`);
  const to = new Date(`${toDateStr}T00:00:00Z`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function celsiusToFahrenheit(tempC: number): number {
  return tempC * (9 / 5) + 32;
}

/** profiles.temp_unit(§6.1)에 맞춰 반올림된 정수 온도 문자열을 만든다. 값이 없으면 null — "0°"로 채우지 않는다 */
export function formatTemp(tempC: number | null | undefined, unit: 'C' | 'F' = 'C'): string | null {
  if (tempC == null || Number.isNaN(tempC)) return null;
  const value = unit === 'F' ? celsiusToFahrenheit(tempC) : tempC;
  return `${Math.round(value)}°`;
}
