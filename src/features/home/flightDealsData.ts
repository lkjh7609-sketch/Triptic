import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { apiUrl } from '@/shared/api/apiUrl';
import { fetchMyrealtripFlightsLink, openInNewTab, type FlightSearch } from '@/features/plan/partnerLinks';

/** api/partnerProducts.js?kind=deals 카드 한 개 — 인기 노선의 최저가 하나 */
export interface FlightDeal {
  /** 도착 공항 코드 */
  code: string;
  city: string;
  airport: string;
  theme: 'japan' | 'sea' | 'far';
  price: number;
  currency: string;
  departDate: string;
  returnDate: string;
  airline: string | null;
  airlineName: string | null;
  /** 평균 왕복가(모르면 null) */
  average: number | null;
  /** 평균보다 싼 정도(%, 5% 미만이면 null) */
  discountPct: number | null;
}

/** 특가는 인천 출발 5일 왕복 기준 — 서울(인천) 출발 문구와 맞춘다 */
export const DEAL_ORIGIN = 'ICN';
const DEAL_PERIOD = 5;

async function fetchFlightDeals(): Promise<FlightDeal[]> {
  const params = new URLSearchParams({ provider: 'myrealtrip', kind: 'deals', origin: DEAL_ORIGIN, period: String(DEAL_PERIOD) });
  const res = await fetch(apiUrl(`/api/partnerProducts?${params.toString()}`));
  if (!res.ok) throw new Error(`flightDeals HTTP ${res.status}`);
  const json = (await res.json()) as { items?: unknown };
  return Array.isArray(json.items) ? (json.items as FlightDeal[]) : [];
}

/** 특가 목록 — 특가 카드와 테마 카드가 같은 요청을 나눠 쓴다. 실패·빈 목록은 오래 붙잡지 않는다 */
export function useFlightDeals() {
  return useQuery({
    queryKey: ['flightDeals', DEAL_ORIGIN, DEAL_PERIOD, 'v1'],
    queryFn: fetchFlightDeals,
    staleTime: (query) => (query.state.data && query.state.data.length > 0 ? 60 * 60 * 1000 : 0),
    retry: 1,
  });
}

/** 214,800 — 원 단위 숫자만(단위 글자는 번역 문구가 붙인다) */
export function formatWon(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(Math.round(amount));
}

/** 10.22 — 카드 한 줄에 들어가게 짧은 월.일 */
export function formatMonthDay(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${Number(m)}.${d}`;
}

/** 특가 노선을 인천 출발 왕복 검색으로 — 마이리얼트립 항공 결과(마이링크)를 새 탭으로 연다 */
export function openDeal(deal: FlightDeal): Promise<boolean> {
  const flight: FlightSearch = {
    origin: DEAL_ORIGIN,
    originType: 'airport',
    destination: deal.code,
    destinationType: 'airport',
    departDate: deal.departDate,
    returnDate: deal.returnDate,
    adults: 1,
  };
  return openInNewTab(() => fetchMyrealtripFlightsLink(flight, 'flights'));
}

/** 테마별로 가장 싼 도시 하나(테마에 특가가 없으면 그 테마는 빠진다) */
export function cheapestByTheme(deals: FlightDeal[]): Partial<Record<FlightDeal['theme'], FlightDeal>> {
  const best: Partial<Record<FlightDeal['theme'], FlightDeal>> = {};
  for (const deal of deals) {
    const cur = best[deal.theme];
    if (!cur || deal.price < cur.price) best[deal.theme] = deal;
  }
  return best;
}

/** 오늘 이전 출발일이 섞이지 않게(저장값이라 며칠 지난 날짜가 올 수 있다) */
export function upcomingDeals(deals: FlightDeal[], today = format(new Date(), 'yyyy-MM-dd')): FlightDeal[] {
  const from = format(addDays(new Date(`${today}T00:00:00`), 1), 'yyyy-MM-dd');
  return deals.filter((d) => d.departDate >= from);
}
