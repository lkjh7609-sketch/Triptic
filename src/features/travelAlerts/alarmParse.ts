/* i18n-exempt-file: 외교부 API 응답 문구(한국어 원문)를 해석하는 규칙 */
/**
 * 외교부 '국가·지역별 여행경보'(data.go.kr TravelAlarmService2/getTravelAlarmList2) 응답을 우리 표 모양으로 정리한다.
 * 한 나라가 지역별로 여러 줄이고 지역은 자유 문장이라, 도시와 맞추지 않고 "나라 기본 단계"(그 나라의 '나머지 지역' 줄)만
 * 따로 표시해 둔다 — 기본 줄이 없는 나라(일본: 후쿠시마만 3단계)는 기본 단계가 없다.
 * Edge Function(travel-alerts-refresh)과 시험이 같이 쓰므로 React·브라우저 API에 기대지 않는다.
 */

export interface AlarmRow {
  country_code: string;
  country_name_ko: string;
  country_name_en: string;
  /** 1 여행유의 · 2 여행자제 · 3 출국권고 · 4 여행금지 */
  alarm_lvl: 1 | 2 | 3 | 4;
  /** 'all' 나라 전체, 'part' 일부 지역 */
  region_scope: 'all' | 'part';
  /** 해당 지역 설명(외교부 원문, 한국어) */
  remark: string;
  /** 그 나라의 '나머지 지역'(또는 전 지역) 줄 — 도시에 적용하는 기본 단계 */
  is_base: boolean;
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&middot;': '·',
  '&bull;': '•',
  '&ccedil;': 'ç',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function decodeEntities(text: string): string {
  return text
    .replace(/&(?:nbsp|middot|bull|ccedil|amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** '나머지 지역' 줄의 말투 — "…를 제외한 지역", "…이외 지역", "전 지역" 등. 지역 줄 안의 "(1,2단계 지역 제외)" 같은 괄호 설명은 걸리지 않는다 */
const BASE_REMARK = /제외한|제외\s*전|이외|그\s*외|외\s*전|외\s*지역|^전\s?지역$|^전체$/;

interface RawAlarm {
  alarm_lvl?: unknown;
  country_iso_alp2?: unknown;
  country_nm?: unknown;
  country_eng_nm?: unknown;
  region_ty?: unknown;
  remark?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** 응답 줄들 → AlarmRow. 단계가 1~4가 아니거나 나라 코드가 없는 줄은 버린다 */
export function normalizeAlarms(items: unknown): AlarmRow[] {
  if (!Array.isArray(items)) return [];
  const rows: AlarmRow[] = [];
  for (const raw of items as RawAlarm[]) {
    const lvl = Number(raw?.alarm_lvl);
    const code = str(raw?.country_iso_alp2).trim().toUpperCase();
    if (!(lvl >= 1 && lvl <= 4) || !/^[A-Z]{2}$/.test(code)) continue;
    const remark = decodeEntities(str(raw.remark));
    const scope = str(raw.region_ty).trim() === '전체' ? 'all' : 'part';
    rows.push({
      country_code: code,
      country_name_ko: str(raw.country_nm).trim(),
      country_name_en: str(raw.country_eng_nm).trim(),
      alarm_lvl: lvl as AlarmRow['alarm_lvl'],
      region_scope: scope,
      remark,
      is_base: scope === 'all' || BASE_REMARK.test(remark),
    });
  }
  return rows;
}

/** 응답 한 장에서 줄 목록 꺼내기(항목이 하나면 배열이 아니라 객체로 오기도 한다). 정상 응답이 아니면 null */
export function extractAlarmItems(json: unknown): unknown[] | null {
  const body = (
    json as { response?: { header?: { resultCode?: unknown }; body?: { items?: unknown } } }
  )?.response;
  const code = String(body?.header?.resultCode ?? '');
  if (code !== '0' && code !== '00') return null;
  const items = (body?.body?.items as { item?: unknown } | undefined)?.item;
  if (items == null) return [];
  return Array.isArray(items) ? items : [items];
}
