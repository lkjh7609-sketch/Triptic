-- ============================================================================
-- 0006: 날씨 캐시 — weather_cache, climate_normals
-- 출처: docs/specs/03-data-model.md §3.5
-- ============================================================================

-- grid_key = round(lat,2)||','||round(lng,2)  (약 1.1km 격자 → 캐시 적중률 극대화)
create table if not exists public.weather_cache (
  grid_key   text not null,
  date       date not null,
  provider   text not null default 'weatherkit',
  payload    jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (grid_key, date, provider)
);
create index if not exists weather_cache_fetched_at_idx on public.weather_cache (fetched_at);

-- 예보 범위(약 10일)를 넘는 날짜용 기후 평년값
create table if not exists public.climate_normals (
  grid_key   text not null,
  month      int  not null check (month between 1 and 12),
  tmin_c     numeric(4,1),
  tmax_c     numeric(4,1),
  precip_mm  numeric(6,1),
  source     text not null,
  primary key (grid_key, month)
);
