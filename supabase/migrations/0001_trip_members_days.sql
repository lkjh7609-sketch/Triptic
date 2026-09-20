-- ============================================================================
-- 0001: 동행자(trip_members) + 일차(trip_days)
-- 출처: docs/specs/03-data-model.md §3.2
-- 전제: 0000_reconcile_legacy_schema.sql 적용 완료 (public.profiles, public.trips.owner_id 존재)
-- ============================================================================

-- 동행자 (기존 '공유 링크'와 별개로, 편집 권한을 가진 멤버)
create table if not exists public.trip_members (
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.trip_days (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references public.trips(id) on delete cascade,
  day_index int  not null check (day_index >= 1),
  date      date not null,
  city_name text,
  city_lat  double precision,
  city_lng  double precision,
  timezone  text,                          -- 그 날의 기준 타임존
  note      text,
  unique (trip_id, day_index)
);
