-- ============================================================================
-- 0028: 장소 좌표 캐시 (api/recommend.js — Google Places 호출 절약)
--
-- ⚠️ 프로덕션에는 이 파일이 아닌 수동 SQL로 먼저 만들어졌고, 그때 정책이
-- "Enable read/write access for all users"(FOR ALL USING true WITH CHECK true)였다.
-- 즉 공개 anon 키만 있으면 누구나 좌표/주소 캐시를 고치거나 지울 수 있었다.
-- 이 마이그레이션은 이미 있는 테이블에도 안전하게 적용되도록 작성했고, 그 정책을
-- 지운다. 서버(service_role)만 읽고 쓰므로 공개 정책은 두지 않는다.
-- ============================================================================

create table if not exists public.place_cache (
  query_key  text primary key,
  place_id   text,
  lat        double precision,
  lng        double precision,
  address    text,
  created_at timestamptz default now()
);

alter table public.place_cache enable row level security;

drop policy if exists "Enable read/write access for all users" on public.place_cache;
drop policy if exists "Enable read access for all users" on public.place_cache;

revoke all on table public.place_cache from anon, authenticated;
