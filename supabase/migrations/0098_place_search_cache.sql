-- ============================================================================
-- 0098: 장소 검색 보조(Text Search) 결과 캐시 — api/recommend.js mode=placeSearch
--
-- 일정 추가·호텔·식사 검색에서 구글 자동완성이 비었을 때 서버가 Places Text Search를 부른다(호출당 약 $0.032).
-- 같은 도시권에서 같은 검색어("동물원")는 처음 한 번만 부르고 이 표에서 돌려준다.
-- 기간 제한 없이 계속 쓴다(place_cache와 같은 방식, 사용자 결정). 참고: 구글 약관은 좌표·주소 캐시를 30일까지로 적고 있다.
-- 서버(service_role)만 읽고 쓴다 — 공개 정책 없음.
-- ============================================================================

create table if not exists public.place_search_cache (
  query_key  text primary key,
  results    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.place_search_cache enable row level security;
revoke all on table public.place_search_cache from anon, authenticated;
