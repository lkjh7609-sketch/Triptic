-- ============================================================================
-- 0009: 집계 RPC (대시보드) — get_user_travel_stats
-- 출처: docs/specs/03-data-model.md §5
-- 안전: security invoker — RLS를 그대로 통과시켜 남의 데이터가 섞이지 않게 한다.
-- (definer로 만들면 RLS를 우회하므로 auth.uid() 조건을 한 군데라도 빠뜨리면
--  전체 사용자 데이터가 새어 나간다 — 기존 스키마의 get_trip_full_data 교훈 참고)
-- ============================================================================

create or replace function public.get_user_travel_stats()
returns json
language sql stable security invoker
set search_path = public, pg_temp
as $fn$
  with my_trips as (
    select * from public.trips
    where owner_id = auth.uid() and deleted_at is null
  ),
  done as (select * from my_trips where end_date < current_date),
  days as (
    select distinct d.date
    from public.trip_days d join done t on t.id = d.trip_id
  )
  select json_build_object(
    'tripCount',    (select count(*) from done),
    'countryCount', (select count(distinct i.country_code)
                       from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.country_code is not null),
    'cityCount',    (select count(distinct d.city_name)
                       from public.trip_days d join done t on t.id = d.trip_id
                      where d.city_name is not null),
    'dayCount',     (select count(*) from days),
    'placeCount',   (select count(*) from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.type in ('place','meal','activity')),
    'groundMeters', (select coalesce(sum(l.distance_m), 0)
                       from public.legs l join done t on t.id = l.trip_id
                      where l.mode <> 'flight'),
    'countries',    (select coalesce(json_agg(distinct i.country_code), '[]'::json)
                       from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.country_code is not null)
  );
$fn$;

grant execute on function public.get_user_travel_stats() to authenticated;
