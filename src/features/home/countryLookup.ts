/**
 * 국가명 → ISO 3166-1 alpha-2 코드 변환 (02-screens.md §2.4 세계지도용)
 * trips.city / dayCities[*].name은 Google Places 도시 자동완성의
 * formatted_address("Tokyo, Japan")에서 온다 — 이 마지막 쉼표 뒤 영문 국가명을
 * react-svg-worldmap이 내장한 국가명(ISO 코드 매핑표)과 대조한다.
 *
 * 두 소스의 표기가 다른 몇몇 흔한 경우만 별칭으로 보정한다 — Google Places가
 * 실제로 어떤 문자열을 돌려주는지 전수 확인은 못 했으므로(라이브 API 호출
 * 필요), 실사용 중 매칭 안 되는 국가가 발견되면 이 표에 추가한다.
 */
import { regions } from 'react-svg-worldmap';

const NAME_TO_CODE = new Map<string, string>();
for (const r of regions) {
  NAME_TO_CODE.set(r.name.toLowerCase(), r.code);
}

const ALIASES: Record<string, string> = {
  'south korea': 'KR',
  'north korea': 'KP',
  'korea, republic of': 'KR',
  usa: 'US',
  'united states of america': 'US',
  uk: 'GB',
  'great britain': 'GB',
  russia: 'RU',
  vatican: 'IT',
  'ivory coast': 'CI',
  'czech republic': 'CZ',
  czechia: 'CZ',
  'macedonia': 'MK',
  'myanmar (burma)': 'MM',
  burma: 'MM',
  'hong kong': 'CN',
  macau: 'CN',
  'republic of ireland': 'IE',
};

export function countryNameToIso(name: string): string | null {
  const key = name.trim().toLowerCase();
  return NAME_TO_CODE.get(key) ?? ALIASES[key] ?? null;
}
