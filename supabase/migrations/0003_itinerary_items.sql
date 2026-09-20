-- ============================================================================
-- 0003: 일정 항목 (itinerary_items)
-- 출처: docs/specs/03-data-model.md §3.2, §3.3.1(전방 참조 해소)
-- ============================================================================

create table if not exists public.itinerary_items (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  day_id          uuid not null references public.trip_days(id) on delete cascade,
  position        int  not null,
  type            text not null check (type in
                    ('place','meal','lodging','transport','flight','activity','note')),
  title           text not null,
  subtitle        text,
  category        text,
  google_place_id text,
  lat             double precision,
  lng             double precision,
  address         text,
  country_code    char(2),
  start_local     text check (start_local ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  end_local       text check (end_local   ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  timezone        text,
  start_at        timestamptz,
  memo            text,
  estimated_cost  numeric(14,2),
  -- ⚠️ bookings는 0002에서 이미 생성되었으므로 여기서 바로 참조 가능하지만, 스펙
  --    §3.3.1의 명시적 순서를 그대로 따라 FK는 아래 alter table로 별도 추가한다.
  booking_id      uuid,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- note를 제외한 모든 항목은 좌표가 있어야 한다 (지도에 그려야 하므로)
  constraint coords_required check (type = 'note' or (lat is not null and lng is not null))
);
create index if not exists itinerary_items_trip_day_position_idx
  on public.itinerary_items (trip_id, day_id, position);
create index if not exists itinerary_items_trip_start_at_idx
  on public.itinerary_items (trip_id, start_at);
create index if not exists itinerary_items_country_code_idx
  on public.itinerary_items (country_code) where country_code is not null;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'itinerary_items_booking_id_fkey' and table_name = 'itinerary_items'
  ) then
    alter table public.itinerary_items
      add constraint itinerary_items_booking_id_fkey
      foreign key (booking_id) references public.bookings(id) on delete set null;
  end if;
end $$;
