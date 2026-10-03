/* i18n-exempt-file: 공공데이터 API가 주는 한국어 이름·필드를 해석하는 순수 함수(Edge Function과 화면·시험이 같이 쓴다) */
/**
 * 항공편 자동입력의 순수 로직 — 인천공항 정기편 시즌 스케줄(여행 플랫폼용 API)과 한국공항공사 운항 스케줄(국제선·국내선)을
 * 편명+날짜로 맞춘다. 외부 import 없이 서버(Edge Function)·브라우저 어디서나 돈다.
 *
 * 자료 해석(실제 응답으로 확인):
 *  - 인천 API: 편명·인천쪽 시각(st: 출발편이면 인천 출발, 도착편이면 인천 도착)·터미널·상대 공항·운항 기간·요일. 상대 공항의 시각은 없다.
 *  - 한국공항공사 국제선: internationalTime = **도착 공항(airportCode)의 현지 도착 시각**, cityCode = 출발 공항.
 *    (KE623 인천 18:50 출발 → airportCode MNL, 2205 = 마닐라 22:05 도착)
 *  - 한국공항공사 국내선: 출발·도착 시각이 모두 있다.
 */

export type Direction = 'dep' | 'arr';
export type TerminalKey = 't1' | 't1c' | 't2';

export interface IcnScheduleRow {
  flight_id: string;
  direction: Direction;
  first_date: string; // YYYY-MM-DD
  last_date: string;
  /** 인천쪽 시각 HHMM */
  st: string;
  /** 월~일 운항 여부 */
  days: boolean[];
  terminal: TerminalKey | null;
  airline_ko: string;
  airline_code: string;
  /** 공동운항(Slave) 편이면 실제로 운항하는 대표 편명 — 한국공항공사는 대표 편명만 갖고 있다. 아니면 '' */
  master_flight_id: string;
  other_airport_code: string;
  other_airport_ko: string;
}

export interface LookupAirport {
  iata: string;
  nameKo: string;
  /** HH:MM, 모르면 '' */
  time: string;
  terminal: TerminalKey | null;
}

export interface LookupFlight {
  flightNo: string;
  date: string;
  airlineKo: string;
  airlineCode: string;
  dep: LookupAirport;
  arr: LookupAirport;
  /** 도착 공항 현지 도착 날짜 — 상대 공항→인천 편에서 인천 도착일이 출발일과 다를 때(밤새 비행)만 채운다 */
  arrDate?: string;
  source: 'icn' | 'kac-dom';
}

export type LookupReason = 'not_found' | 'out_of_range' | 'not_published';
export type LookupResponse =
  { found: true; flight: LookupFlight } | { found: false; reason: LookupReason };

export const ICN_CODE = 'ICN';
export const ICN_NAME_KO = '인천';

/** 편명 정리 — 공백·하이픈을 없애고 대문자로 */
export function normalizeFlightNo(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidYmd(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && !Number.isNaN(Date.parse(`${ymd}T00:00:00Z`));
}

/** 월=0 … 일=6 */
export function weekdayIndex(ymd: string): number {
  const day = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 일=0
  return (day + 6) % 7;
}

/** 'HHMM' → 'HH:MM'. 모양이 다르면 '' */
export function hhmmToTime(value: string | null | undefined): string {
  const m = /^(\d{2})(\d{2})$/.exec(String(value ?? '').trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return '';
  return `${m[1]}:${m[2]}`;
}

/** 'YYYYMMDD' 또는 'YYYY-MM-DDT…' → 'YYYY-MM-DD'. 모르면 '' */
export function toYmd(value: string | null | undefined): string {
  const s = String(value ?? '').trim();
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return iso ? iso[1] : '';
}

/** 인천 터미널 코드 → 화면 키. P01 제1터미널, P02 제1터미널 탑승동, P03 제2터미널 */
export function terminalKeyOf(code: string | null | undefined): TerminalKey | null {
  if (code === 'P01') return 't1';
  if (code === 'P02') return 't1c';
  if (code === 'P03') return 't2';
  return null;
}

export function rowCoversDate(
  row: Pick<IcnScheduleRow, 'first_date' | 'last_date' | 'days'>,
  ymd: string,
): boolean {
  return row.first_date <= ymd && ymd <= row.last_date && row.days[weekdayIndex(ymd)] === true;
}

interface RawIcnItem {
  flightId?: unknown;
  st?: unknown;
  firstdate?: unknown;
  lastdate?: unknown;
  ynMon?: unknown;
  ynTue?: unknown;
  ynWed?: unknown;
  ynThu?: unknown;
  ynFri?: unknown;
  ynSat?: unknown;
  ynSun?: unknown;
  terminalId?: unknown;
  airline?: unknown;
  airlineCode?: unknown;
  airportCode?: unknown;
  airport?: unknown;
  codeshare?: unknown;
  masterFlightId?: unknown;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** 인천 API 응답 줄들 → 표 행. 편명·날짜·시각이 제대로 없는 줄은 버린다 */
export function normalizeIcnSchedule(items: unknown, direction: Direction): IcnScheduleRow[] {
  if (!Array.isArray(items)) return [];
  const rows: IcnScheduleRow[] = [];
  for (const raw of items as RawIcnItem[]) {
    const flight = normalizeFlightNo(str(raw?.flightId));
    const first = toYmd(str(raw?.firstdate));
    const last = toYmd(str(raw?.lastdate));
    const st = str(raw?.st);
    if (!flight || !first || !last || !hhmmToTime(st)) continue;
    rows.push({
      flight_id: flight,
      direction,
      first_date: first,
      last_date: last,
      st,
      days: [raw.ynMon, raw.ynTue, raw.ynWed, raw.ynThu, raw.ynFri, raw.ynSat, raw.ynSun].map(
        (v) => v === 'Y',
      ),
      terminal: terminalKeyOf(str(raw.terminalId)),
      airline_ko: str(raw.airline),
      airline_code: str(raw.airlineCode).toUpperCase(),
      master_flight_id:
        str(raw.codeshare) === 'Slave' ? normalizeFlightNo(str(raw.masterFlightId)) : '',
      other_airport_code: str(raw.airportCode).toUpperCase(),
      other_airport_ko: str(raw.airport),
    });
  }
  return rows;
}

/** YYYY-MM-DD에 n일을 더한다 */
export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 편명이 같은 줄들 중 그 날짜에 운항하는 것. 시즌이 겹치는 줄이 여럿이면 시작일이 늦은(더 최근에 정해진) 것 */
export function pickIcnRow(rows: IcnScheduleRow[], ymd: string): IcnScheduleRow | null {
  const hits = rows.filter((r) => rowCoversDate(r, ymd));
  if (hits.length === 0) return null;
  return hits.sort((a, b) => b.first_date.localeCompare(a.first_date))[0];
}

// ---- 시각·시간대 계산 (밤새 날아오는 귀국편의 인천 도착일을 구하는 데 쓴다) ----

/** 그 시각(UTC ms)에 해당 시간대의 UTC 오프셋(분) */
export function tzOffsetMinutes(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const v = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return Math.round((asUtc - utcMs) / 60000);
}

/** 해당 시간대의 현지 날짜·시각(YYYY-MM-DD, HHMM) → UTC ms */
export function localToUtcMs(ymd: string, hhmm: string, timeZone: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Number(hhmm.slice(0, 2)), Number(hhmm.slice(2, 4)));
  let utc = guess - tzOffsetMinutes(timeZone, guess) * 60000;
  utc = guess - tzOffsetMinutes(timeZone, utc) * 60000; // 서머타임 경계에서 한 번 더 맞춘다
  return utc;
}

/** UTC ms → 해당 시간대의 현지 날짜(YYYY-MM-DD) */
export function ymdInZone(utcMs: number, timeZone: string): string {
  return new Date(utcMs + tzOffsetMinutes(timeZone, utcMs) * 60000).toISOString().slice(0, 10);
}

/**
 * 출발 공항 현지 날짜·시각과 도착 공항 현지 시각으로 비행시간(분)을 구한다. 도착 날짜는 모르므로 출발보다 뒤이면서 가장 가까운 날로 본다
 * (24시간을 넘는 비행은 없다고 본다).
 */
export function flightDurationMin(
  depYmd: string,
  depHhmm: string,
  depTz: string,
  arrHhmm: string,
  arrTz: string,
): number {
  const depUtc = localToUtcMs(depYmd, depHhmm, depTz);
  const arrZoneDay = ymdInZone(depUtc, arrTz);
  for (let k = -1; k <= 2; k++) {
    const arrUtc = localToUtcMs(addDays(arrZoneDay, k), arrHhmm, arrTz);
    if (arrUtc > depUtc) return Math.round((arrUtc - depUtc) / 60000);
  }
  return 0;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 같은 노선 출발편이 없을 때의 어림 비행시간(분) — 인천 출발 실측 750여 편에 맞춘 값(거리 ÷ 시속 약 790km + 63분, 중앙값 오차 5분·p10/p90 ±38분) */
export function estimateDurationMin(km: number): number {
  return Math.round(63 + 0.0756 * km);
}

export interface ArrivalPick {
  row: IcnScheduleRow;
  /** 인천 도착 날짜 */
  arrDate: string;
  /** 계산한 상대 공항 출발 날짜가 사용자가 적은 날짜와 맞았는가 — 아니면 적은 날짜 → 하루 뒤 순으로 운항하는 쪽을 쓴 것 */
  matched: boolean;
}

/**
 * 상대 공항→인천 편: 사용자가 적은 날짜(typedYmd)는 **상대 공항에서 탑승하는 날**이다. 스케줄은 인천 도착일 기준이라
 * 도착일 후보(적은 날, 하루 뒤)마다 "도착 시각 − 비행시간"으로 상대 공항 출발 날짜를 구해 적은 날짜와 맞는 쪽을 고른다.
 * durationMin/originTz를 모르면(null) 계산 없이 적은 날 → 하루 뒤 순으로 운항하는 쪽을 쓴다.
 */
export function pickArrivalForDeparture(
  rows: IcnScheduleRow[],
  typedYmd: string,
  durationMin: number | null,
  originTz: string | null,
): ArrivalPick | null {
  const arrRows = rows.filter((r) => r.direction === 'arr');
  const candidates = [typedYmd, addDays(typedYmd, 1)]
    .map((arrDate) => ({ arrDate, row: pickIcnRow(arrRows, arrDate) }))
    .filter((c): c is { arrDate: string; row: IcnScheduleRow } => !!c.row);
  if (candidates.length === 0) return null;
  if (durationMin != null && originTz) {
    for (const c of candidates) {
      const arrUtc = localToUtcMs(c.arrDate, c.row.st, 'Asia/Seoul');
      if (ymdInZone(arrUtc - durationMin * 60000, originTz) === typedYmd)
        return { ...c, matched: true };
    }
  }
  return { ...candidates[0], matched: false };
}

/** 편명은 아는데 그 날짜에 운항하지 않을 때의 이유 — 모든 운항 기간이 그 날짜보다 앞서 끝났으면 아직 공개되지 않은(다음 시즌) 날짜로 본다 */
export function missReason(rows: IcnScheduleRow[], ymd: string): LookupReason {
  if (rows.length === 0) return 'not_found';
  const lastEnd = rows.reduce((max, r) => (r.last_date > max ? r.last_date : max), '');
  return ymd > lastEnd ? 'not_published' : 'out_of_range';
}

export interface KacIntItem {
  airportCode?: unknown;
  cityCode?: unknown;
  internationalNum?: unknown;
  internationalTime?: unknown;
  internationalStdate?: unknown;
  internationalEddate?: unknown;
  internationalMon?: unknown;
  internationalTue?: unknown;
  internationalWed?: unknown;
  internationalThu?: unknown;
  internationalFri?: unknown;
  internationalSat?: unknown;
  internationalSun?: unknown;
}

function kacDays(item: Record<string, unknown>, prefix: string): boolean[] {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
    (d) => item[`${prefix}${d}`] === 'Y',
  );
}

/**
 * 한국공항공사 국제선 줄들에서 "인천 → 상대 공항" 편의 상대 공항 도착 시각(현지) 찾기.
 * cityCode가 출발 공항, airportCode가 도착 공항이다. 그 날짜(기간·요일)에 운항하는 줄만 쓰고, 시각이 여럿이면 가장 최근 시작한 줄.
 */
export function kacArrivalTime(
  items: unknown,
  flightNo: string,
  fromCode: string,
  toCode: string,
  ymd: string,
): string {
  if (!Array.isArray(items)) return '';
  const hits = (items as KacIntItem[])
    .filter((it) => {
      const rec = it as Record<string, unknown>;
      if (normalizeFlightNo(str(it?.internationalNum)) !== flightNo) return false;
      if (
        str(it.cityCode).toUpperCase() !== fromCode ||
        str(it.airportCode).toUpperCase() !== toCode
      )
        return false;
      const first = toYmd(str(it.internationalStdate));
      const last = toYmd(str(it.internationalEddate));
      return (
        !!first &&
        !!last &&
        rowCoversDate(
          { first_date: first, last_date: last, days: kacDays(rec, 'international') },
          ymd,
        )
      );
    })
    .sort((a, b) =>
      toYmd(str(b.internationalStdate)).localeCompare(toYmd(str(a.internationalStdate))),
    );
  return hits.length ? hhmmToTime(str(hits[0].internationalTime)) : '';
}

export interface KacDomItem {
  airlineKorean?: unknown;
  arrivalcity?: unknown;
  arrivalcityCode?: unknown;
  domesticArrivalTime?: unknown;
  domesticEddate?: unknown;
  domesticNum?: unknown;
  domesticStartTime?: unknown;
  domesticStdate?: unknown;
  startcity?: unknown;
  startcityCode?: unknown;
}

/** 한국공항공사 국내선 줄들에서 그 날짜에 운항하는 편 — 출발·도착 시각이 모두 있다 */
export function pickDomestic(items: unknown, flightNo: string, ymd: string): LookupFlight | null {
  if (!Array.isArray(items)) return null;
  const hits = (items as KacDomItem[])
    .filter((it) => {
      if (normalizeFlightNo(str(it?.domesticNum)) !== flightNo) return false;
      const first = toYmd(str(it.domesticStdate));
      const last = toYmd(str(it.domesticEddate));
      return (
        !!first &&
        !!last &&
        rowCoversDate(
          {
            first_date: first,
            last_date: last,
            days: kacDays(it as Record<string, unknown>, 'domestic'),
          },
          ymd,
        )
      );
    })
    .sort((a, b) => toYmd(str(b.domesticStdate)).localeCompare(toYmd(str(a.domesticStdate))));
  const it = hits[0];
  if (!it) return null;
  return {
    flightNo,
    date: ymd,
    airlineKo: str(it.airlineKorean),
    airlineCode: flightNo.slice(0, 2),
    dep: {
      iata: str(it.startcityCode).toUpperCase(),
      nameKo: str(it.startcity),
      time: hhmmToTime(str(it.domesticStartTime)),
      terminal: null,
    },
    arr: {
      iata: str(it.arrivalcityCode).toUpperCase(),
      nameKo: str(it.arrivalcity),
      time: hhmmToTime(str(it.domesticArrivalTime)),
      terminal: null,
    },
    source: 'kac-dom',
  };
}

/**
 * 같은 노선(인천→toCode) 출발편들의 실제 비행시간(분) 중앙값 — 인천 출발 시각(인천 표)과 한국공항공사의 상대 공항 현지 도착 시각으로 구한다.
 * kacItems는 그 노선·날짜의 한국공항공사 국제선 줄들. 구할 수 있는 편이 없으면 null.
 */
export function routeDurationMin(
  kacItems: unknown,
  depRows: IcnScheduleRow[],
  toCode: string,
  ymd: string,
  arrTz: string,
): number | null {
  const durations: number[] = [];
  for (const row of depRows) {
    if (row.direction !== 'dep' || row.other_airport_code !== toCode || !rowCoversDate(row, ymd))
      continue;
    const arrival = kacArrivalTime(
      kacItems,
      row.master_flight_id || row.flight_id,
      ICN_CODE,
      toCode,
      ymd,
    );
    if (!arrival) continue;
    const minutes = flightDurationMin(ymd, row.st, 'Asia/Seoul', arrival.replace(':', ''), arrTz);
    if (minutes >= 30 && minutes <= 1000) durations.push(minutes);
  }
  return median(durations);
}

/** 인천 줄 + (출발편이면) 한국공항공사가 준 상대 공항 도착 시각 → 조회 결과 */
export function buildIcnFlight(
  row: IcnScheduleRow,
  ymd: string,
  otherAirportTime: string,
  arrDate?: string,
): LookupFlight {
  const icn: LookupAirport = {
    iata: ICN_CODE,
    nameKo: ICN_NAME_KO,
    time: hhmmToTime(row.st),
    terminal: row.terminal,
  };
  const other: LookupAirport = {
    iata: row.other_airport_code,
    nameKo: row.other_airport_ko,
    time: otherAirportTime,
    terminal: null,
  };
  return {
    flightNo: row.flight_id,
    date: ymd,
    airlineKo: row.airline_ko,
    airlineCode: row.airline_code,
    dep: row.direction === 'dep' ? icn : other,
    arr: row.direction === 'dep' ? other : icn,
    ...(arrDate && arrDate !== ymd ? { arrDate } : {}),
    source: 'icn',
  };
}
