/* i18n-exempt-file: LLM 응답의 좌석 등급 한국어 표기(일반석 등)를 읽는 정규식 */
/**
 * LLM 응답 → ParsedBooking[] (필드 단위로 너그럽게)
 *
 * 예전에는 응답 전체를 zod 스키마 하나로 검사해서, 필드 하나만 형식이 어긋나도
 * ("BA 2714"처럼 편명에 공백, 초까지 붙은 시각, 소문자 코드) 응답 전체를 버렸다 —
 * 사용자는 "자동 인식에 실패"만 보게 된다. 여기서는 필드마다 흔한 표기를 정리해 보고,
 * 그래도 형식에 안 맞는 필드만 {value:null, confidence:0}으로 비운다.
 */
import type { ParsedActivity, ParsedBooking, ParsedCarRental, ParsedFlight, ParsedLodging, ParsedRail } from './schema.ts';

type Leaf<T> = { value: T | null; confidence: number };

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function readLeaf(raw: unknown): { value: unknown; confidence: number } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) {
    const c = Number((raw as { confidence?: unknown }).confidence);
    return { value: (raw as { value: unknown }).value, confidence: Number.isFinite(c) ? clamp01(c) : 0.5 };
  }
  return { value: raw, confidence: 0.5 };
}

function leaf<T>(raw: unknown, coerce: (v: unknown) => T | null): Leaf<T> {
  const { value, confidence } = readLeaf(raw);
  if (value === null || value === undefined || value === '') return { value: null, confidence: 0 };
  const v = coerce(value);
  return v === null ? { value: null, confidence: 0 } : { value: v, confidence };
}

const str = (v: unknown): string | null => {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
};

const iata3 = (v: unknown): string | null => {
  const s = str(v)?.toUpperCase().replace(/[^A-Z]/g, '');
  return s && s.length === 3 ? s : null;
};

const carrier2 = (v: unknown): string | null => {
  const s = str(v)?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s && /^[A-Z0-9]{2}$/.test(s) ? s : null;
};

const flightNo = (v: unknown): string | null => {
  const s = str(v)?.toUpperCase().replace(/[\s-]/g, '');
  return s && /^[A-Z0-9]{2}\d{1,4}$/.test(s) ? s : null;
};

const TERMINAL_PREFIX = /^(terminal|term\.?|t|터미널)\s*/i;
const terminal = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const t = s.replace(TERMINAL_PREFIX, '').trim();
  return t || null;
};

/** "YYYY-MM-DDTHH:mm" — 공백 구분·초·밀리초·시간대 표기는 잘라낸다. 날짜만 있으면 T00:00(신뢰도 낮춤은 호출부) */
function localDateTime(v: unknown): { value: string; dateOnly: boolean } | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  if (h === undefined) return { value: `${y}-${mo}-${d}T00:00`, dateOnly: true };
  if (Number(h) > 23 || Number(mi) > 59) return null;
  return { value: `${y}-${mo}-${d}T${h.padStart(2, '0')}:${mi}`, dateOnly: false };
}

function dateTimeLeaf(raw: unknown): Leaf<string> {
  const { value, confidence } = readLeaf(raw);
  const dt = localDateTime(value);
  if (!dt) return { value: null, confidence: 0 };
  // 시각이 없으면 자정으로 채우되 확인이 필요하다는 뜻으로 신뢰도를 낮춘다
  return { value: dt.value, confidence: dt.dateOnly ? Math.min(confidence, 0.3) : confidence };
}

type Cabin = 'economy' | 'premium_economy' | 'business' | 'first';
const cabin = (v: unknown): Cabin | null => {
  const s = str(v)?.toLowerCase().replace(/[\s-]+/g, '_');
  if (!s) return null;
  if (/premium/.test(s) || s === 'w') return 'premium_economy';
  if (/econom|coach|일반|이코노미/.test(s) || s === 'y') return 'economy';
  if (/business|비즈니스|프레스티지|prestige/.test(s) || s === 'c' || s === 'j') return 'business';
  if (/first|일등|퍼스트/.test(s) || s === 'f') return 'first';
  return null;
};

const positiveInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(str(v)?.replace(/[^\d.]/g, ''));
  return Number.isInteger(n) && n > 0 ? n : null;
};

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function flight(raw: Record<string, unknown>): ParsedFlight {
  const dep = obj(raw.departure);
  const arr = obj(raw.arrival);
  const number = leaf(raw.flightNumber, flightNo);
  const carrier = leaf(raw.carrierIata, carrier2);
  // 편명은 있는데 항공사 코드가 없으면 편명 앞 두 글자
  if (!carrier.value && number.value) {
    carrier.value = number.value.slice(0, 2);
    carrier.confidence = number.confidence;
  }
  return {
    kind: 'flight',
    carrierIata: carrier,
    carrierName: leaf(raw.carrierName, str),
    flightNumber: number,
    departure: {
      airportIata: leaf(dep.airportIata, iata3),
      airportName: leaf(dep.airportName, str),
      terminal: leaf(dep.terminal, terminal),
      scheduledLocal: dateTimeLeaf(dep.scheduledLocal),
    },
    arrival: {
      airportIata: leaf(arr.airportIata, iata3),
      airportName: leaf(arr.airportName, str),
      terminal: leaf(arr.terminal, terminal),
      scheduledLocal: dateTimeLeaf(arr.scheduledLocal),
    },
    bookingReference: leaf(raw.bookingReference, str),
    seat: leaf(raw.seat, str),
    cabinClass: leaf(raw.cabinClass, cabin),
  };
}

function lodging(raw: Record<string, unknown>): ParsedLodging {
  return {
    kind: 'lodging',
    propertyName: leaf(raw.propertyName, str),
    address: leaf(raw.address, str),
    checkInLocal: dateTimeLeaf(raw.checkInLocal),
    checkOutLocal: dateTimeLeaf(raw.checkOutLocal),
    roomType: leaf(raw.roomType, str),
    guestCount: leaf(raw.guestCount, positiveInt),
    bookingReference: leaf(raw.bookingReference, str),
    phone: leaf(raw.phone, str),
  };
}

function rail(raw: Record<string, unknown>): ParsedRail {
  const dep = obj(raw.departure);
  const arr = obj(raw.arrival);
  return {
    kind: 'rail',
    carrierName: leaf(raw.carrierName, str),
    trainNumber: leaf(raw.trainNumber, str),
    departure: { stationName: leaf(dep.stationName, str), scheduledLocal: dateTimeLeaf(dep.scheduledLocal) },
    arrival: { stationName: leaf(arr.stationName, str), scheduledLocal: dateTimeLeaf(arr.scheduledLocal) },
    seat: leaf(raw.seat, str),
    bookingReference: leaf(raw.bookingReference, str),
  };
}

function carRental(raw: Record<string, unknown>): ParsedCarRental {
  const pu = obj(raw.pickup);
  const dof = obj(raw.dropoff);
  return {
    kind: 'car_rental',
    company: leaf(raw.company, str),
    vehicleType: leaf(raw.vehicleType, str),
    pickup: { locationName: leaf(pu.locationName, str), scheduledLocal: dateTimeLeaf(pu.scheduledLocal) },
    dropoff: { locationName: leaf(dof.locationName, str), scheduledLocal: dateTimeLeaf(dof.scheduledLocal) },
    bookingReference: leaf(raw.bookingReference, str),
  };
}

function activity(raw: Record<string, unknown>): ParsedActivity {
  return {
    kind: 'activity',
    name: leaf(raw.name, str),
    address: leaf(raw.address, str),
    scheduledLocal: dateTimeLeaf(raw.scheduledLocal),
    durationMinutes: leaf(raw.durationMinutes, positiveInt),
    bookingReference: leaf(raw.bookingReference, str),
  };
}

/** 알아볼 값이 하나도 없는 항목(빈 껍데기)은 뺀다 */
function hasContent(b: ParsedBooking): boolean {
  switch (b.kind) {
    case 'flight':
      return !!(b.flightNumber.value || b.departure.scheduledLocal.value || b.departure.airportIata.value);
    case 'lodging':
      return !!(b.propertyName.value || b.checkInLocal.value);
    case 'rail':
      return !!(b.trainNumber.value || b.departure.scheduledLocal.value);
    case 'car_rental':
      return !!(b.company.value || b.pickup.scheduledLocal.value);
    case 'activity':
      return !!(b.name.value || b.scheduledLocal.value);
  }
}

const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(obj) : []);

/** {flights, lodgings, rail, carRentals, activities} 모양(또는 kind가 붙은 bookings 배열)을 받아 정리한다 */
export function normalizeLlmEnvelope(raw: unknown): ParsedBooking[] {
  const env = obj(raw);
  const out: ParsedBooking[] = [
    ...arr(env.flights).map(flight),
    ...arr(env.lodgings).map(lodging),
    ...arr(env.rail).map(rail),
    ...arr(env.carRentals).map(carRental),
    ...arr(env.activities).map(activity),
  ];
  for (const b of arr(env.bookings)) {
    if (b.kind === 'flight') out.push(flight(b));
    else if (b.kind === 'lodging') out.push(lodging(b));
    else if (b.kind === 'rail') out.push(rail(b));
    else if (b.kind === 'car_rental') out.push(carRental(b));
    else if (b.kind === 'activity') out.push(activity(b));
  }
  return out.filter(hasContent);
}
