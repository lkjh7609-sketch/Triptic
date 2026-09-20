-- ============================================================================
-- 0014: 임시 집계 RPC (홈 대시보드) — get_user_travel_stats_snapshot
-- 출처: docs/specs/02-screens.md §2.2 (통계 정의)
--
-- 왜 필요한가: 0009의 get_user_travel_stats()는 정규화 테이블(itinerary_items/
-- trip_days/legs)을 대상으로 하는데, 이 테이블들은 아직 실제 이관 데이터가
-- 없다(supabase/migrations/README.md M2~M4 미완료 — trips.snapshot(JSONB) →
-- 정규화 테이블 전환은 "가장 위험한 작업"으로 별도 승인 후 진행 예정). 이관
-- 전까지 trips.snapshot에서 직접 같은 모양(JSON 키)의 통계를 계산하는 임시
-- 버전이다. **이관(M4) 완료 후 클라이언트가 get_user_travel_stats()로 갈아타면
-- 이 함수와 이 마이그레이션은 삭제한다.**
--
-- 국가/도시 판정: trips.city와 snapshot.dayCities[*].name은
-- "Tokyo, Japan"처럼 Google Places 도시 자동완성의 formatted_address 형식을
-- 전제한다(CreateTripModal.tsx/DayCityModal.tsx). 쉼표 앞을 도시명, 마지막
-- 쉼표 뒤를 국가명으로 본다 — 쉼표가 없는(레거시 자유 텍스트 등) 값은 도시로는
-- 세지만 국가로는 세지 않는다(오탐 방지, 데이터 없으면 빈 채로 둔다는 원칙과
-- 동일선상).
--
-- groundMeters: 스냅샷에는 구간 거리가 저장되지 않는다(클라이언트가 지도를
-- 그릴 때만 Directions API로 계산해 세션 메모리 캐시에만 둔다 —
-- src/features/plan/map/useTripRoutes.ts sharedDirectionsCache, DB에 영속화
-- 안 됨). 그래서 이 필드는 항상 null이다 — 0으로 채우면 "실제로 이동거리가
-- 0km"처럼 보이므로 명확히 구분한다(05-weather.md §5.1과 같은 원칙: 데이터
-- 없으면 값을 지어내지 않는다). 정규화 이관 후 legs.distance_m으로 채워진다.
--
-- 안전: security invoker — RLS를 그대로 통과시킨다(0009와 동일 원칙).
-- ============================================================================

create or replace function public.get_user_travel_stats_snapshot()
returns json
language sql stable security invoker
set search_path = public, pg_temp
as $fn$
  with my_trips as (
    select * from public.trips
    where owner_id = (select auth.uid()) and deleted_at is null
  ),
  done as (
    select * from my_trips where end_date < current_date
  ),
  city_country_names as (
    select
      trim(split_part(name, ',', 1)) as city_name,
      case when position(',' in name) > 0
        then trim(substring(name from '[^,]*$'))
        else null
      end as country_name
    from (
      select city as name from done where city is not null and city <> ''
      union all
      select day_city.value->>'name' as name
      from done, lateral jsonb_each(coalesce(done.snapshot->'dayCities', '{}'::jsonb)) as day_city
      where coalesce(day_city.value->>'name', '') <> ''
    ) all_names
  )
  select json_build_object(
    'tripCount', (select count(*) from done),
    'countryCount', (
      select count(distinct country_name) from city_country_names where country_name is not null
    ),
    'cityCount', (
      select count(distinct city_name) from city_country_names
      where city_name is not null and city_name <> ''
    ),
    'dayCount', (
      select count(distinct gs::date)
      from done, lateral generate_series(done.start_date::timestamp, done.end_date::timestamp, interval '1 day') gs
      where done.start_date is not null and done.end_date is not null
    ),
    'placeCount', (
      select coalesce(sum(
        case when jsonb_typeof(day_items.value) = 'array' then jsonb_array_length(day_items.value) else 0 end
      ), 0)
      from done, lateral jsonb_each(coalesce(done.snapshot->'data', '{}'::jsonb)) as day_items
    ),
    'groundMeters', null,
    'countries', (
      select coalesce(json_agg(distinct country_name), '[]'::json)
      from city_country_names where country_name is not null
    )
  );
$fn$;

grant execute on function public.get_user_travel_stats_snapshot() to authenticated;
