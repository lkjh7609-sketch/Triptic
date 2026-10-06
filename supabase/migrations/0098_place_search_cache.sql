-- ============================================================================
-- 0098: 장소 검색 보조(Text Search) 결과 캐시 — api/recommend.js mode=placeSearch
--
-- 일정 추가·호텔·식사 검색에서 구글 자동완성이 비었을 때 서버가 Places Text Search를 부른다(호출당 약 $0.032).
-- 같은 도시권에서 같은 검색어("동물원")는 처음 한 번만 부르고 이 표에서 돌려준다.
-- 구글 약관상 좌표·주소 캐시는 30일까지라 읽을 때 30일 안에 만든 행만 쓴다(오래된 행은 덮어쓴다).
-- 서버(service_role)만 읽고 쓴다 — 공개 정책 없음.
-- ============================================================================

create table if not exists public.place_search_cache (
  query_key  text primary key,
  results    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.place_search_cache enable row level security;
revoke all on table public.place_search_cache from anon, authenticated;
