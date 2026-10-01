import { apiUrl } from '@/shared/api/apiUrl';
import { type ActivityFilters, type ActivitySort, searchKeyword, serverMaxPrice, serverSort } from './activityFilters';

/** api/partnerProducts.js 카드 한 개 */
export interface ActivityProduct {
  id: string;
  title: string;
  category: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  rating: number | null;
  reviewCount: number | null;
  tags: string[];
  url: string;
}

export interface ActivityPage {
  items: ActivityProduct[];
  hasNextPage: boolean;
  totalCount: number | null;
}

export interface ActivityCategory {
  name: string;
  value: string;
}

/** 서버에 한 번에 받는 개수(API 상한 20). 화면에는 이보다 적게(PC 8·모바일 4) 나눠 보여준다 */
export const API_PAGE_SIZE = 20;

export function listParams(city: string, sort: ActivitySort, filters: ActivityFilters, page: number): URLSearchParams {
  const params = new URLSearchParams({
    provider: 'myrealtrip',
    kind: 'list',
    q: searchKeyword(city, filters),
    size: String(API_PAGE_SIZE),
    page: String(page),
  });
  if (filters.category) params.set('category', filters.category);
  const maxPrice = serverMaxPrice(filters);
  if (maxPrice) params.set('maxPrice', String(maxPrice));
  const sortValue = serverSort(sort);
  if (sortValue) params.set('sort', sortValue);
  return params;
}

export async function fetchActivityPage(city: string, sort: ActivitySort, filters: ActivityFilters, page: number): Promise<ActivityPage> {
  const res = await fetch(apiUrl(`/api/partnerProducts?${listParams(city, sort, filters, page).toString()}`));
  if (!res.ok) throw new Error(`partnerProducts HTTP ${res.status}`);
  const json = (await res.json()) as Partial<ActivityPage>;
  return {
    items: Array.isArray(json.items) ? json.items.map((item) => ({ ...item, tags: Array.isArray(item.tags) ? item.tags : [] })) : [],
    hasNextPage: json.hasNextPage === true,
    totalCount: typeof json.totalCount === 'number' ? json.totalCount : null,
  };
}

export async function fetchActivityCategories(city: string): Promise<ActivityCategory[]> {
  const params = new URLSearchParams({ provider: 'myrealtrip', kind: 'categories', q: city });
  const res = await fetch(apiUrl(`/api/partnerProducts?${params.toString()}`));
  if (!res.ok) throw new Error(`partnerProducts HTTP ${res.status}`);
  const json = (await res.json()) as { categories?: unknown };
  return Array.isArray(json.categories) ? (json.categories as ActivityCategory[]) : [];
}
