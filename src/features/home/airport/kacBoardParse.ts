/* i18n-exempt-file: 한국공항공사 API가 주는 한국어 노선 구분(국내·국제)을 코드로 잇는 데이터 */
/**
 * 한국공항공사 '실시간 항공기 운항정보 조회'(B551178/flight-status/info) → 인천과 같은 전광판 줄(BoardFlight).
 * Edge Function(kac-board)과 화면이 같이 쓰는 순수 함수(외부 import 없음).
 *
 * 인천 API와 다른 점(2026-10-04 실제 응답으로 확인):
 *  · 한 번에 13개 공항이 다 온다(airport=그 공항, io=O 출발/I 도착, city=상대 공항). schAirCode로 한 공항만 받을 수도 있다.
 *  · 공동운항이 편명마다 따로 한 줄씩 오고 어느 편이 실제 운항편인지 표시가 없다 → 같은 공항·방향·예정·변경 시각·상대 공항·게이트면
 *    한 줄로 묶는다(사용자 결정). 대표 편은 편명 번호가 가장 작은 편(추정 — 가끔 틀릴 수 있음).
 *  · 터미널 대신 국내·국제 구분만 있다 → terminal 'DOM'/'INTL'(터미널 칸에 국내선/국제선, 사용자 결정).
 *  · 도착편도 수하물 수취대 없이 게이트만 준다 → gate에 둔다(도착 표의 그 칸 제목은 '게이트', 사용자 결정).
 *  · 시각 'HHmm', 변경 시각이 없으면 null. 상태가 아직 없는 편이 많다(빈 문자열).
 */

/** boardParse.BoardFlight와 같은 모양 — Edge Function(Deno)이 이 파일만 가져가도 되게 다른 파일을 import하지 않는다 */
export interface BoardFlight {
  id: string;
  airline: string;
  scheduled: string;
  estimated: string;
  city: string;
  airportCode: string;
  terminal: string;
  gate: string;
  counter: string;
  carousel: string;
  exit: string;
  remark: string;
  codeshares: { id: string; airline: string }[];
  stopovers: string[];
}

/** 'HHMM'이 맞는 모양이면 그대로, 아니면 ''(boardParse.cleanHhmm과 같다) */
function cleanHhmm(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^([01]\d|2[0-3])[0-5]\d$/.test(s) ? s : '';
}

export interface KacAirportBoard {
  departures: BoardFlight[];
  arrivals: BoardFlight[];
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

/** 편명 숫자 부분('LJ513' → 513) — 대표 편을 고를 때 쓴다 */
function flightNumber(id: string): number {
  const m = /(\d+)/.exec(id);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
}

/** API 줄 → 공항별 출발·도착 전광판(공동운항 묶음, 시각 → 편명 순) */
export function normalizeKacBoard(items: readonly Record<string, unknown>[]): Record<string, KacAirportBoard> {
  const groups = new Map<string, { airport: string; io: string; flights: BoardFlight[] }>();
  for (const raw of items) {
    const airport = text(raw.airport);
    const io = text(raw.io);
    const id = text(raw.airFln);
    const scheduled = cleanHhmm(raw.std);
    if (!airport || (io !== 'O' && io !== 'I') || !id || !scheduled) continue;
    const estimated = cleanHhmm(raw.etd) || scheduled;
    const line = text(raw.line);
    const flight: BoardFlight = {
      id,
      airline: text(raw.airlineKorean),
      scheduled,
      estimated,
      city: text(io === 'O' ? raw.arrivedKor : raw.boardingKor),
      airportCode: text(raw.city),
      terminal: line === '국제' ? 'INTL' : line === '국내' ? 'DOM' : '',
      gate: text(raw.gate),
      counter: '',
      carousel: '',
      exit: '',
      remark: text(raw.rmkKor),
      codeshares: [],
      stopovers: [],
    };
    const key = [airport, io, scheduled, estimated, flight.airportCode, flight.gate].join('|');
    const g = groups.get(key);
    if (g) {
      if (!g.flights.some((f) => f.id === id)) g.flights.push(flight);
    } else groups.set(key, { airport, io, flights: [flight] });
  }

  const boards: Record<string, KacAirportBoard> = {};
  for (const { airport, io, flights } of groups.values()) {
    const sorted = [...flights].sort((a, b) => flightNumber(a.id) - flightNumber(b.id) || a.id.localeCompare(b.id));
    const [main, ...rest] = sorted;
    // 상태는 묶음 안에서 비어 있지 않은 것(대표 편이 비어 있고 다른 편에 있으면 그것)
    const remark = main.remark || rest.find((f) => f.remark)?.remark || '';
    const row: BoardFlight = { ...main, remark, codeshares: rest.map((f) => ({ id: f.id, airline: f.airline })) };
    const board = (boards[airport] ??= { departures: [], arrivals: [] });
    (io === 'O' ? board.departures : board.arrivals).push(row);
  }
  for (const board of Object.values(boards)) {
    for (const list of [board.departures, board.arrivals]) list.sort((a, b) => a.scheduled.localeCompare(b.scheduled) || a.id.localeCompare(b.id));
  }
  return boards;
}
