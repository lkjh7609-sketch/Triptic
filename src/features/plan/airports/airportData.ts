/** 항공편 입력용 공항 목록(airports 표, 0079) — 목록 타입과 검색·표시 이름 규칙(순수 함수) */

export type LocaleNames = Partial<Record<'ko' | 'en' | 'ja' | 'zh-TW', string>>;

export interface Airport {
  iata: string;
  country_code: string;
  /** 공항 이름 */
  name: LocaleNames;
  /** 그 공항이 있는 도시 이름 */
  city: LocaleNames;
  lat: number;
  lng: number;
  timezone: string;
}

/** 표시 언어에 맞는 이름 — 그 언어가 없으면 영어, 그것도 없으면 있는 것 하나 */
export function pickName(names: LocaleNames | undefined, language: string): string {
  if (!names) return '';
  const key = language.startsWith('ko')
    ? 'ko'
    : language.startsWith('ja')
      ? 'ja'
      : language.startsWith('zh')
        ? 'zh-TW'
        : 'en';
  return names[key] || names.en || Object.values(names).find(Boolean) || '';
}

/** 검색용 정규화 — 소문자, 악센트·공백·기호 제거 */
export function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-·.,'()/]/g, '');
}

function haystacks(a: Airport, countryName?: string): { city: string[]; name: string[] } {
  return {
    city: [...Object.values(a.city), countryName ?? ''].filter(Boolean).map(normalizeQuery),
    name: Object.values(a.name)
      .filter(Boolean)
      .map((n) => normalizeQuery(n as string)),
  };
}

/**
 * 공항 검색 — 공항 코드 정확히 일치가 맨 위, 그다음 도시 이름으로 시작, 공항 이름으로 시작, 코드로 시작, 그 안에 들어 있는 것.
 * 도시·공항 이름은 모든 언어로 찾고(한국어로 써도 영어 이름이 걸림), 국가 이름(현재 언어)도 찾는다.
 */
export function searchAirports(
  airports: readonly Airport[],
  query: string,
  { countryName, limit = 8 }: { countryName?: (code: string) => string; limit?: number } = {},
): Airport[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const scored: { a: Airport; score: number }[] = [];
  for (const a of airports) {
    const iata = a.iata.toLowerCase();
    const { city, name } = haystacks(a, countryName?.(a.country_code));
    let score = 0;
    if (iata === q) score = 100;
    else if (city.some((c) => c.startsWith(q))) score = 80;
    else if (name.some((n) => n.startsWith(q))) score = 60;
    else if (q.length >= 2 && iata.startsWith(q)) score = 50;
    else if (city.some((c) => c.includes(q)) || name.some((n) => n.includes(q))) score = 30;
    if (score > 0) scored.push({ a, score });
  }
  return scored
    .sort((x, y) => y.score - x.score || x.a.iata.localeCompare(y.a.iata))
    .slice(0, limit)
    .map((s) => s.a);
}

/** 목록 한 줄의 큰 글씨(도시(국가)) */
export function airportTitle(
  a: Airport,
  language: string,
  countryName: (code: string) => string,
): string {
  const city = pickName(a.city, language) || pickName(a.name, language);
  return `${city}(${countryName(a.country_code)})`;
}

/** 목록 한 줄의 작은 글씨(코드 · 공항 이름) */
export function airportSubtitle(a: Airport, language: string): string {
  return `${a.iata} · ${pickName(a.name, language)}`;
}

/**
 * 등록된 항공편 카드에 쓰는 공항 표기 — "공항 이름 코드"(예: 인천국제공항 ICN). 공항 목록에서 코드로 찾아 표시 언어의 공식 이름을 쓰고,
 * 코드가 없거나 목록에 없으면(예전에 Google로 입력한 항공편) 저장된 이름을 그대로 쓴다.
 */
export function airportCardLabel(
  airport: { iata?: string; name?: string },
  airports: readonly Airport[] | undefined,
  language: string,
): string {
  const hit = airport.iata ? airports?.find((a) => a.iata === airport.iata) : undefined;
  if (hit) {
    const name = pickName(hit.name, language) || pickName(hit.city, language);
    return `${name} ${hit.iata}`.trim();
  }
  return airport.name || airport.iata || '?';
}
