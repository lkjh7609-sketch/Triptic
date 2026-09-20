-- ============================================================================
-- 0004: 구간(legs) — 항목 간 이동 경로 캐시
-- 출처: docs/specs/03-data-model.md §3.2
-- ============================================================================

create table if not exists public.legs (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  from_item_id     uuid not null references public.itinerary_items(id) on delete cascade,
  to_item_id       uuid not null references public.itinerary_items(id) on delete cascade,
  mode             text not null default 'transit',
  distance_m       int,
  duration_s       int,
  is_estimate      boolean not null default false,
  encoded_polyline text,
  provider         text not null default 'google_directions',
  fetched_at       timestamptz not null default now(),
  unique (from_item_id, to_item_id, mode)
);
create index if not exists legs_trip_id_idx on public.legs (trip_id);
-- 30일 지난 경로 캐시는 정리 (요금·경로가 바뀔 수 있음)
create index if not exists legs_fetched_at_idx on public.legs (fetched_at);
