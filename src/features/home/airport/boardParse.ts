/* i18n-exempt-file: 인천공항 API가 주는 한국어 상태 문구(출발·탑승중…)를 번역 키로 잇는 데이터 */
/**
 * 인천공항 출·도착 전광판 데이터(인천국제공항공사 '여객기 운항 현황 조회 서비스(다국어)', data.go.kr) 정리.
 * Edge Function(incheon-board)과 화면이 같이 쓰는 순수 함수라 서버·브라우저 어디서나 돈다(외부 import 없음).
 */

export type BoardDirection = 'departures' | 'arrivals';

/** API가 주는 한 줄(필요한 칸만) */
export interface RawFlight {
  airline?: string | null;
  flightId?: string | null;
  scheduleDateTime?: string | null;
  estimatedDateTime?: string | null;
  airport?: string | null;
  airportCode?: string | null;
  gatenumber?: string | null;
  chkinrange?: string | null;
  carousel?: string | null;
  exitnumber?: string | null;
  remark?: string | null;
  codeshare?: string | null;
  masterflightid?: string | null;
  terminalId?: string | null;
  typeOfFlight?: string | null;
  firstopovername?: string | null;
  secstopovername?: string | null;
  thistopovername?: string | null;
}

export interface CodeshareFlight {
  id: string;
  airline: string;
}

/** 화면이 쓰는 한 편 — 공동운항(Slave) 편은 대표 편(Master) 아래로 묶는다 */
export interface BoardFlight {
  id: string;
  airline: string;
  /** 예정 시각 'HHMM' */
  scheduled: string;
  /** 변경(예상) 시각 'HHMM' — 없으면 예정과 같다 */
  estimated: string;
  /** 출발편은 목적지, 도착편은 출발지(한국어 이름) */
  city: string;
  /** IATA 공항 코드(언어와 무관하게 보여 줄 수 있다) */
  airportCode: string;
  terminal: string;
  gate: string;
  /** 출발: 체크인 카운터 범위 */
  counter: string;
  /** 도착: 수하물 수취대 */
  carousel: string;
  /** 도착: 출구 */
  exit: string;
  /** 상태 원문(한국어) — '출발'·'탑승중'·'지연' 등 */
  remark: string;
  codeshares: CodeshareFlight[];
  stopovers: string[];
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** 'HHMM'이 맞는 모양이면 그대로, 아니면 '' */
export function cleanHhmm(v: unknown): string {
  const s = text(v);
  return /^([01]\d|2[0-3])[0-5]\d$/.test(s) ? s : '';
}

/** 'HHMM' → 그날 0시부터의 분. 모양이 틀리면 null */
export function hhmmToMinutes(hhmm: string): number | null {
  const clean = cleanHhmm(hhmm);
  if (!clean) return null;
  return Number(clean.slice(0, 2)) * 60 + Number(clean.slice(2));
}

/** 'HHMM' → 'HH:MM' */
export function formatHhmm(hhmm: string): string {
  const clean = cleanHhmm(hhmm);
  return clean ? `${clean.slice(0, 2)}:${clean.slice(2)}` : '';
}

function toFlight(raw: RawFlight): BoardFlight | null {
  const id = text(raw.flightId);
  const scheduled = cleanHhmm(raw.scheduleDateTime);
  if (!id || !scheduled) return null;
  return {
    id,
    airline: text(raw.airline),
    scheduled,
    estimated: cleanHhmm(raw.estimatedDateTime) || scheduled,
    city: text(raw.airport),
    airportCode: text(raw.airportCode),
    terminal: text(raw.terminalId),
    gate: text(raw.gatenumber),
    counter: text(raw.chkinrange),
    carousel: text(raw.carousel),
    exit: text(raw.exitnumber),
    remark: text(raw.remark),
    codeshares: [],
    stopovers: [raw.firstopovername, raw.secstopovername, raw.thistopovername]
      .map(text)
      .filter(Boolean),
  };
}

/**
 * API 응답 줄들을 전광판 줄로 정리한다 — 공동운항(Slave) 편은 대표 편(Master) 아래로 묶고,
 * 대표 편이 이 시간대에 없으면 그 편이 자기 줄이 된다. 시각 → 편명 순으로 정렬. 같은 편명이 두 번 오면 처음 것만.
 */
export function normalizeBoard(items: readonly RawFlight[]): BoardFlight[] {
  const masters = new Map<string, BoardFlight>();
  const slaves: { raw: RawFlight; flight: BoardFlight }[] = [];

  for (const raw of items) {
    const flight = toFlight(raw);
    if (!flight) continue;
    if (text(raw.codeshare) === 'Slave' && text(raw.masterflightid)) slaves.push({ raw, flight });
    else if (!masters.has(flight.id)) masters.set(flight.id, flight);
  }

  for (const { raw, flight } of slaves) {
    const master = masters.get(text(raw.masterflightid));
    if (master) {
      if (!master.codeshares.some((c) => c.id === flight.id))
        master.codeshares.push({ id: flight.id, airline: flight.airline });
    } else if (!masters.has(flight.id)) {
      masters.set(flight.id, flight);
    }
  }

  return [...masters.values()].sort(
    (a, b) => a.scheduled.localeCompare(b.scheduled) || a.id.localeCompare(b.id),
  );
}

/** data.go.kr JSON 응답에서 줄 배열을 꺼낸다 — 비면 "" 이나 null, 한 줄이면 객체로 오기도 한다 */
export function extractItems(json: unknown): RawFlight[] {
  const items = (json as { response?: { body?: { items?: unknown } } } | null)?.response?.body
    ?.items;
  const list = Array.isArray(items) ? items : items && typeof items === 'object' ? [items] : [];
  const nested = (list as { item?: unknown }[]).flatMap((x) =>
    x && typeof x === 'object' && 'item' in x ? (Array.isArray(x.item) ? x.item : [x.item]) : [x],
  );
  return nested.filter((x): x is RawFlight => !!x && typeof x === 'object');
}

/** 응답 머리말의 결과 코드가 정상('00')인가 */
export function isNormalResponse(json: unknown): boolean {
  return (
    (json as { response?: { header?: { resultCode?: string } } } | null)?.response?.header
      ?.resultCode === '00'
  );
}

/** 한국 시각(KST)의 지금을 'HHMM'과 분으로 */
export function kstNow(now: Date = new Date()): { hhmm: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return {
    hhmm: `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`,
    minutes: h * 60 + m,
  };
}

export const WINDOW_BEFORE_MIN = 60;
export const WINDOW_AFTER_MIN = 240;

/** 조회할 시간대 — 지금 −1시간 ~ +4시간(하루를 넘지 않게 0000~2359로 자른다) */
export function boardWindow(now: Date = new Date()): { from: string; to: string } {
  const { minutes } = kstNow(now);
  const pad = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, '0')}${String(n % 60).padStart(2, '0')}`;
  return {
    from: pad(Math.max(0, minutes - WINDOW_BEFORE_MIN)),
    to: pad(Math.min(1439, minutes + WINDOW_AFTER_MIN)),
  };
}

/**
 * 지금(분) 기준으로 이 편이 몇 분 뒤인가 — 음수면 이미 지난 시각. 자정을 넘기는 경우(23:50에 00:05)를 12시간 기준으로 맞춘다.
 * 변경(예상) 시각 기준이다(전광판처럼 늦춰진 편은 늦춰진 시각 자리에 있다).
 */
export function minutesFromNow(
  flight: Pick<BoardFlight, 'estimated' | 'scheduled'>,
  nowMinutes: number,
): number {
  const at = hhmmToMinutes(flight.estimated) ?? hhmmToMinutes(flight.scheduled) ?? nowMinutes;
  let diff = at - nowMinutes;
  if (diff < -720) diff += 1440;
  else if (diff > 720) diff -= 1440;
  return diff;
}

/** 변경(예상) 시각이 예정보다 몇 분 늦은가 — 앞당겨졌으면 음수, 같으면 0. 자정을 넘기는 경우도 맞게 */
export function delayMinutes(flight: Pick<BoardFlight, 'estimated' | 'scheduled'>): number {
  const sched = hhmmToMinutes(flight.scheduled);
  const est = hhmmToMinutes(flight.estimated);
  if (sched == null || est == null) return 0;
  let diff = est - sched;
  if (diff < -720) diff += 1440;
  else if (diff > 720) diff -= 1440;
  return diff;
}

/** 이미 떠난/내린 지 이만큼(분)이 지나면 전광판에서 뺀다 */
export const KEEP_PAST_MIN = 10;

/** 이보다 먼 미래(분)는 받아 온 시간대(지금 +4시간)에 속하지 않는다 — 자정 기준 맞춤(minutesFromNow)이 반나절 전 편을 내일 편으로 보이게 하는 걸 막는다 */
export const KEEP_AHEAD_MIN = WINDOW_AFTER_MIN + 60;

/** 전광판에 보일 편 — 지난 지 10분 안쪽부터 5시간 안쪽까지, 예상 시각 순 */
export function visibleFlights(flights: readonly BoardFlight[], nowMinutes: number): BoardFlight[] {
  return flights
    .map((f) => ({ f, d: minutesFromNow(f, nowMinutes) }))
    .filter(({ d }) => d >= -KEEP_PAST_MIN && d <= KEEP_AHEAD_MIN)
    .sort((a, b) => a.d - b.d || a.f.id.localeCompare(b.f.id))
    .map(({ f }) => f);
}

export type StatusTone = 'done' | 'active' | 'soon' | 'warn' | 'bad' | 'neutral';

/** 알려진 상태 문구 → 번역 키와 색 톤. 모르는 문구는 null(원문을 그대로 보여 준다) */
const STATUS: Record<string, { key: string; tone: StatusTone }> = {
  출발: { key: 'departed', tone: 'done' },
  도착: { key: 'arrived', tone: 'done' },
  착륙: { key: 'landed', tone: 'done' },
  탑승중: { key: 'boarding', tone: 'active' },
  탑승준비: { key: 'boardingSoon', tone: 'soon' },
  체크인오픈: { key: 'checkinOpen', tone: 'soon' },
  체크인마감: { key: 'checkinClosed', tone: 'warn' },
  마감예정: { key: 'closingSoon', tone: 'warn' },
  탑승마감: { key: 'gateClosed', tone: 'warn' },
  지연: { key: 'delayed', tone: 'warn' },
  결항: { key: 'cancelled', tone: 'bad' },
  취소: { key: 'cancelled', tone: 'bad' },
  회항: { key: 'returned', tone: 'bad' },
  변경: { key: 'changed', tone: 'warn' },
  예정: { key: 'scheduled', tone: 'neutral' },
};

export function statusInfo(remark: string): { key: string; tone: StatusTone } | null {
  return STATUS[remark.trim()] ?? null;
}

/** 터미널 코드 → 표시 이름. P01=제1여객터미널, P02=제1터미널 탑승동, P03=제2여객터미널 */
export function terminalLabel(code: string): { key: 't1' | 't1c' | 't2' | null; raw: string } {
  if (code === 'P01') return { key: 't1', raw: code };
  if (code === 'P02') return { key: 't1c', raw: code };
  if (code === 'P03') return { key: 't2', raw: code };
  return { key: null, raw: code };
}

/** 출발 전광판은 지금보다 이만큼(분) 뒤 편에서 시작한다 — 체크인하러 오는 사람이 많아서(사용자 결정). 그 앞 편(탑승중·마감·방금 출발)은 '이전' 쪽 페이지에 있다 */
export const DEPARTURE_LEAD_MIN = 40;

/** 이미 시각 순으로 정렬된 줄에서 지금 + lead분 이후 첫 줄의 위치. 그런 편이 없으면(늦은 밤) 마지막 한 쪽이 보이도록 끝에서 size개 앞 */
export function startOffset(
  flights: readonly BoardFlight[],
  nowMinutes: number,
  leadMinutes: number,
  size: number,
): number {
  if (leadMinutes <= 0) return 0;
  const idx = flights.findIndex((f) => minutesFromNow(f, nowMinutes) >= leadMinutes);
  return idx === -1 ? Math.max(0, flights.length - size) : idx;
}

/**
 * 줄을 쪽으로 나눈다. 쪽은 offset에서 시작해 size개씩 앞으로, offset 앞의 줄은 그 뒤쪽부터 size개씩 거꾸로 묶는다
 * (맨 앞 쪽만 모자랄 수 있다). initial은 offset이 들어 있는 쪽의 위치(0부터).
 */
export function buildPages<T>(
  items: readonly T[],
  offset: number,
  size: number,
): { pages: T[][]; initial: number } {
  const start = Math.min(Math.max(0, offset), items.length);
  const before: T[][] = [];
  for (let end = start; end > 0; end -= size)
    before.unshift(items.slice(Math.max(0, end - size), end));
  const after: T[][] = [];
  for (let i = start; i < items.length; i += size) after.push(items.slice(i, i + size));
  const pages = [...before, ...after];
  return { pages: pages.length > 0 ? pages : [[]], initial: before.length };
}

/** 쪽 번호 줄 — 처음·끝·현재 둘레만 보이고 나머지는 '…'. current는 0부터, 돌려주는 숫자는 1부터 */
export function pageItems(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const page = current + 1;
  const set = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  if (page <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (page >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => set.add(n));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}
