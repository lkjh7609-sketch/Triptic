/* i18n-exempt-file: 구글이 한국어로 돌려주는 도시 이름의 행정구역 접미사(시·특별시…)와 나라 별칭을 다루는 규칙 데이터 */
/** 여행 만들기 도시 자동완성 — 구글 예측 결과를 한 줄 문구로 만드는 규칙(순수 함수) */

export interface CityPredictionLike {
  place_id: string;
  description: string;
  structured_formatting?: { main_text?: string; secondary_text?: string };
}

/**
 * 구글이 도시 이름에 붙여 주는 행정구역 접미사를 뗀다 — 교토시→교토, 서울특별시→서울, 京都市→京都, 東京都→東京.
 * 남는 글자가 한 글자면 떼지 않는다(京都의 都는 이름의 일부).
 */
export function stripAdminSuffix(name: string, language: string): string {
  const value = name.trim();
  let stripped = value;
  if (language.startsWith('ko')) {
    stripped = value.replace(/(특별자치시|특별자치도|특별시|광역시)$/, '');
    if (stripped === value && /시$/.test(value) && value.length >= 3) stripped = value.slice(0, -1);
    if (stripped === value && /^도쿄도$/.test(value)) stripped = '도쿄';
  } else if (language.startsWith('ja')) {
    stripped = value.replace(/(特別市|広域市|特別自治市)$/, '').replace(/[市都]$/, '');
  } else if (language.startsWith('zh')) {
    stripped = value.replace(/(特別市|直轄市)$/, '').replace(/[市都]$/, '');
  }
  return [...stripped].length >= 2 ? stripped : value;
}

const ALIASES = [
  '대만',
  '台灣',
  '台湾',
  'USA',
  'UK',
  'UAE',
  'South Korea',
  '홍콩',
  '香港',
  '마카오',
  '澳門',
  '澳门',
];
const countryNamesCache = new Map<string, string[]>();

/** 그 언어로 쓴 나라 이름들(긴 것부터) — 브라우저 지역 이름표 + 구글이 쓰는 몇몇 다른 표기 */
function countryNames(language: string): string[] {
  const cached = countryNamesCache.get(language);
  if (cached) return cached;
  const names = new Set<string>(ALIASES);
  try {
    const display = new Intl.DisplayNames([language], { type: 'region' });
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const name = display.of(code);
        if (!name || name === code) continue; // 없는 지역 코드는 코드 그대로 돌아온다
        names.add(name);
        names.add(name.replace(/\s*[(（].*$/, '')); // "홍콩(중국 특별행정구)" → "홍콩"
      }
    }
  } catch {
    /* 지역 이름표가 없는 환경 — 별칭만 */
  }
  const list = [...names].filter(Boolean).sort((x, y) => y.length - x.length);
  countryNamesCache.set(language, list);
  return list;
}

/**
 * 구글의 두 번째 줄(secondary_text)에서 나라와 나머지(주·도)를 가른다.
 * 영어는 "OR, USA"(나라가 끝), 한·일·번체는 "일본 교토부"·"日本、京都府"·"日本京都府"(나라가 앞) — 나라 이름표에서 가장 긴 일치를 찾는다.
 */
export function splitSecondary(
  secondary: string | undefined,
  language: string,
): { country: string; region: string } {
  const text = (secondary ?? '').trim();
  if (!text) return { country: '', region: '' };
  const atEnd = !/^(ko|ja|zh)/.test(language);
  for (const name of countryNames(language)) {
    if (atEnd ? text.toLowerCase().endsWith(name.toLowerCase()) : text.startsWith(name)) {
      const rest = atEnd ? text.slice(0, text.length - name.length) : text.slice(name.length);
      return { country: name, region: rest.replace(/^[\s、,，]+|[\s、,，]+$/g, '') };
    }
  }
  // 나라 이름표에 없으면 구글 표기 순서를 믿는다: 영어는 마지막 조각, 그 밖은 첫 조각
  const parts = text.split(/[,、，]\s*|\s+/).filter(Boolean);
  if (parts.length === 1) return { country: parts[0], region: '' };
  return atEnd
    ? { country: parts[parts.length - 1], region: parts.slice(0, -1).join(', ') }
    : { country: parts[0], region: parts.slice(1).join(' ') };
}

export interface CityOption {
  placeId: string;
  /** 큰 글씨 한 줄 — 도시(나라) */
  label: string;
  /** 입력칸에 남길 글자 — 도시 이름만 */
  name: string;
}

/**
 * 예측 목록을 한 줄씩 만든다 — "교토(일본)". 같은 줄이 둘 이상 되는 도시(같은 이름의 다른 도시)는 주·도까지 붙여 가른다:
 * "포틀랜드(미국, 오리건 주)". 구글이 도시 이름을 안 나눠 주면 전체 설명을 쓴다.
 */
export function buildCityOptions(
  predictions: readonly CityPredictionLike[],
  language: string,
): CityOption[] {
  const rows = predictions.map((p) => {
    const main = p.structured_formatting?.main_text?.trim();
    const name = main ? stripAdminSuffix(main, language) : p.description.trim();
    const { country, region } = main
      ? splitSecondary(p.structured_formatting?.secondary_text, language)
      : { country: '', region: '' };
    return { placeId: p.place_id, name, country, region };
  });
  const base = (r: (typeof rows)[number]) =>
    r.country && r.country !== r.name ? `${r.name}(${r.country})` : r.name;
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(base(r), (counts.get(base(r)) ?? 0) + 1);
  return rows.map((r) => {
    const dup = (counts.get(base(r)) ?? 0) > 1;
    const label =
      dup && r.region
        ? r.country
          ? `${r.name}(${r.country}, ${r.region})`
          : `${r.name}(${r.region})`
        : base(r);
    return { placeId: r.placeId, label, name: r.name };
  });
}
