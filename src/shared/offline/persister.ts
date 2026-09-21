/**
 * 오프라인 캐시 (02-screens.md §3.2 데이터 로딩 순서 "1. 캐시된 일정을 즉시
 * 렌더(IndexedDB) → 2. 서버 일정 fetch → diff 반영").
 *
 * TanStack Query의 표준 persist 플러그인을 쓴다 — 쿼리 캐시 전체(여행 목록,
 * 여행 상세, 프로필 등)를 IndexedDB에 저장해두고, 앱 기동 시 캐시를 먼저
 * hydrate해서 즉시 렌더한 뒤, 백그라운드에서 실제 서버 refetch로 갱신한다.
 * 직접 IndexedDB API를 다루는 것보다 이미 검증된 표준 동작(re-fetch on
 * mount, 캐시 만료 등)을 그대로 얻을 수 있어 안전하다.
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

const CACHE_KEY = 'triptic-query-cache';

/** 캐시 유효 기간 — 이보다 오래된 캐시는 hydrate하지 않는다(24시간, react-query 기본 관례). */
export const OFFLINE_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const offlinePersister = createAsyncStoragePersister({
  key: CACHE_KEY,
  storage: {
    getItem: (key) => get(key),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
});

/** 로그아웃 시 호출 — 이전 계정의 캐시가 다음 로그인에 잠깐 노출되는 것을 막는다. */
export async function clearOfflineCache(): Promise<void> {
  await del(CACHE_KEY);
}
