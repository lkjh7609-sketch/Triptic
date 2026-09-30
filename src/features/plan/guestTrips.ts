import { tripService, TripLimitError, type LocalProject, type TripContent, type TripRow } from '@/shared/api/tripService';
import { captureError, track } from '@/shared/monitoring';
import { SAMPLE_TRIP_ID } from './sampleTrip';

/**
 * 로그인 전 임시 여행(게스트 여행) — 가입 전에 여행을 만들어 보게 하고, 로그인하면 계정으로 옮긴다.
 *
 * · 이 기기(localStorage)에만 저장한다. 소셜 로그인은 페이지를 통째로 새로 여는 이동이라
 *   메모리(샘플 여행 방식)는 로그인 사이에 사라지지만 localStorage는 남는다.
 * · Supabase에는 절대 쓰지 않는다(id가 uuid가 아니라 요청 자체가 실패한다). 그래서 "로컬 여행"은
 *   샘플 여행과 같은 취급을 받는다 — isLocalTripId()로 한 번에 판별한다.
 * · 로그인하면 importGuestTrips()가 계정으로 옮기고 이 기기의 임시본을 지운다.
 */
const STORAGE_KEY = 'triptic-guest-trips';
export const GUEST_TRIP_PREFIX = 'guest-';
const IMPORT_TRIED_PREFIX = 'triptic-guest-import-tried:';
/** 로그인 전에 이 기기에 만들 수 있는 임시 여행 수 */
export const GUEST_TRIP_LIMIT = 2;

export function isGuestTripId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(GUEST_TRIP_PREFIX);
}

/** Supabase에 없는 여행(샘플 + 임시 여행) — 저장·서류·공유·동행 같은 서버 기능을 못 쓴다 */
export function isLocalTripId(id: string | null | undefined): boolean {
  return id === SAMPLE_TRIP_ID || isGuestTripId(id);
}

export class GuestTripLimitError extends Error {
  constructor() {
    super('guest_trip_limit');
    this.name = 'GuestTripLimitError';
  }
}

interface Entry {
  /** 계정으로 옮길 때 서버 여행 id로 쓸 uuid — 옮기는 도중 실패해 다시 시도해도 같은 여행을 갱신할 뿐 중복으로 만들지 않는다 */
  importId: string;
  row: TripRow;
}

function readEntries(): Entry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is Entry => !!e && typeof e === 'object' && typeof (e as Entry).importId === 'string' && isGuestTripId((e as Entry).row?.id),
    );
  } catch {
    return [];
  }
}

// useSyncExternalStore가 매번 같은 참조를 받도록, 저장할 때만 새 목록을 만든다
let cache: TripRow[] | null = null;
const listeners = new Set<() => void>();

function writeEntries(entries: Entry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // 저장 공간이 없거나 막힌 브라우저 — 이번 접속 동안은 메모리 목록만 갱신된다
  }
  cache = entries.map((e) => e.row);
  for (const listener of listeners) listener();
}

export function listGuestTrips(): TripRow[] {
  if (!cache) cache = readEntries().map((e) => e.row);
  return cache;
}

export function subscribeGuestTrips(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGuestTrip(id: string): TripRow | null {
  return listGuestTrips().find((row) => row.id === id) ?? null;
}

function newId(): string {
  return crypto.randomUUID();
}

export function createGuestTrip(project: LocalProject, name: string): TripRow {
  const entries = readEntries();
  if (entries.length >= GUEST_TRIP_LIMIT) throw new GuestTripLimitError();
  const now = new Date().toISOString();
  const row: TripRow = {
    id: `${GUEST_TRIP_PREFIX}${newId()}`,
    owner_id: 'guest',
    title: name,
    city: project.city || null,
    city_lat: project.cityLat ?? null,
    city_lng: project.cityLng ?? null,
    start_date: project.startDate || null,
    end_date: project.endDate || null,
    total_days: project.totalDays || null,
    base_currency: project.currency || 'KRW',
    status: 'planning',
    content: {
      data: project.data || {},
      hotels: project.hotels || {},
      meals: project.meals || {},
      expenses: project.expenses || {},
      flights: project.flights || { outbound: null, return: null },
      dayCities: project.dayCities || {},
    },
    created_at: now,
    updated_at: now,
  };
  writeEntries([...entries, { importId: newId(), row }]);
  track('guest_trip_started');
  return row;
}

/** 일정 내용(장소·숙소·식사·경비·항공편)을 고친다 — 여행 상세 화면의 저장이 부른다 */
export function updateGuestTripContent(id: string, content: TripContent): TripRow {
  const entries = readEntries();
  const entry = entries.find((e) => e.row.id === id);
  if (!entry) throw new Error('guest_trip_not_found');
  entry.row = { ...entry.row, content, updated_at: new Date().toISOString() };
  writeEntries(entries);
  return entry.row;
}

export function renameGuestTrip(id: string, title: string): TripRow {
  const entries = readEntries();
  const entry = entries.find((e) => e.row.id === id);
  if (!entry) throw new Error('guest_trip_not_found');
  entry.row = { ...entry.row, title, updated_at: new Date().toISOString() };
  writeEntries(entries);
  return entry.row;
}

export function deleteGuestTrip(id: string): void {
  writeEntries(readEntries().filter((e) => e.row.id !== id));
}

export interface GuestImportResult {
  /** 계정으로 옮긴 여행 — 임시 id → 새 여행 id (지금 임시 여행 화면을 보고 있으면 새 여행으로 옮겨 주려고) */
  imported: Array<{ guestId: string; tripId: string }>;
  /** 계정의 무료 여행 한도에 걸려 일부를 못 옮김(이 기기에 그대로 남는다) */
  limitReached: boolean;
  /** 네트워크 등 다른 이유로 실패(이 기기에 그대로 남고 다음 로그인 때 다시 시도) */
  failed: boolean;
}

function isTripLimit(err: unknown): boolean {
  return err instanceof TripLimitError || (typeof err === 'object' && err !== null && (err as { hint?: string }).hint === 'trip_limit_reached');
}

let inFlight: Promise<GuestImportResult> | null = null;

/**
 * 로그인한 사용자의 계정으로 임시 여행을 옮긴다. 성공한 것만 이 기기에서 지운다.
 * 로그인 이벤트가 여러 번 오거나 개발 모드에서 효과가 두 번 돌아도 한 번만 실행되도록 진행 중이면 같은 약속을 돌려준다
 * (안 그러면 여행이 중복으로 만들어지고 무료 한도가 두 배로 줄어든다).
 */
export function importGuestTrips(): Promise<GuestImportResult> {
  if (inFlight) return inFlight;
  inFlight = runImport().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runImport(): Promise<GuestImportResult> {
  const result: GuestImportResult = { imported: [], limitReached: false, failed: false };
  for (const entry of readEntries()) {
    try {
      // supabaseId를 미리 정한 uuid로 넘기면 saveTrip이 그 id로 만들거나(없으면) 갱신한다 — 다시 시도해도 중복이 안 생긴다
      const saved = await tripService.saveTrip({ ...tripService.toLocalProject(entry.row), supabaseId: entry.importId }, entry.row.title);
      deleteGuestTrip(entry.row.id);
      result.imported.push({ guestId: entry.row.id, tripId: saved.id });
      track('guest_trip_saved');
      track('trip_created', { source: 'guest_import' });
    } catch (err) {
      if (isTripLimit(err)) {
        result.limitReached = true;
        track('trip_limit_reached');
      } else {
        result.failed = true;
        captureError(err, { context: 'importGuestTrips' });
      }
      break;
    }
  }
  return result;
}

/**
 * 로그인한 접속마다 부르는 진입점 — 한 사용자당 한 접속(세션)에 한 번만 옮겨 본다.
 * 옮기지 못한 임시 여행(무료 한도·네트워크)이 남아 있어도 앱을 열 때마다 같은 안내와 한도 이벤트가 반복되지 않게.
 * 못 옮긴 건 다음 접속에 다시 시도한다. 로그아웃하면 표시를 지운다(같은 접속에서 다시 임시 여행을 만들고 로그인하는 경우).
 */
export function importGuestTripsOncePerSession(userId: string): Promise<GuestImportResult> | null {
  if (listGuestTrips().length === 0) return null;
  const key = `${IMPORT_TRIED_PREFIX}${userId}`;
  try {
    if (sessionStorage.getItem(key)) return null;
    sessionStorage.setItem(key, '1');
  } catch {
    // 세션 저장소를 못 쓰는 환경 — 표시 없이 진행(진행 중 중복 방지는 importGuestTrips가 한다)
  }
  return importGuestTrips();
}

export function forgetGuestImportAttempts(): void {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(IMPORT_TRIED_PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {
    // 무시
  }
}

/** 테스트용 — 모듈 안 메모리 상태를 저장소에서 다시 읽게 한다 */
export function resetGuestTripsCacheForTest(): void {
  cache = null;
  inFlight = null;
}
