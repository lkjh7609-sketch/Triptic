import type { FlightSearch } from './partnerLinks';

/**
 * 일정·체크리스트의 "항공권 찾기"가 항공 탭을 열 때 한 번만 바로 검색하게 하는 표시.
 * 운임 검색은 유료 호출(월 상한)이라 새로고침·뒤로 가기·공유 링크로 열 때는 폼만 채우고 [검색]을 누르게 한다 —
 * 표시는 읽는 순간 지워지므로 그다음 열림은 자동 검색이 아니다.
 */
const KEY = 'triptic-flights-autosearch';

export function markFlightsAutoSearch(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // 저장소를 못 쓰면 자동 검색 없이 폼만 채워 열린다
  }
}

/** 표시가 있었으면 true(그리고 지운다) */
export function takeFlightsAutoSearch(): boolean {
  try {
    const marked = sessionStorage.getItem(KEY) === '1';
    sessionStorage.removeItem(KEY);
    return marked;
  } catch {
    return false;
  }
}

const IATA = /^[A-Z]{3}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** 항공 탭 주소(origin·destination·depart_date·return_date·adults·children·infants) → 검색 조건. 모자라거나 틀리면 null */
export function flightFromParams(params: URLSearchParams, today: string): FlightSearch | null {
  const origin = (params.get('origin') ?? '').toUpperCase();
  const destination = (params.get('destination') ?? '').toUpperCase();
  const depart = params.get('depart_date') ?? '';
  const ret = params.get('return_date');
  if (!IATA.test(origin) || !IATA.test(destination) || origin === destination) return null;
  if (!YMD.test(depart) || depart < today) return null;
  if (ret !== null && ret !== '' && (!YMD.test(ret) || ret < depart)) return null;
  const count = (key: string, min: number, fallback: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isInteger(n) && n >= min && n <= 9 ? n : fallback;
  };
  const adults = count('adults', 1, 1);
  const children = Math.min(count('children', 0, 0), 9 - adults);
  const infants = Math.min(count('infants', 0, 0), adults);
  return {
    origin,
    originType: 'city',
    destination,
    destinationType: 'city',
    departDate: depart,
    returnDate: ret ? ret : null,
    adults,
    children,
    infants,
  };
}
