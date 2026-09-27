-- ============================================================================
-- 0034: 여행 목록 카드용 경량 요약 RPC
--
-- listTrips()는 의도적으로 content(정규화 테이블 전체 재구성)를 채우지 않는다
-- (0018/tripService.ts 주석 — 비용이 드는 RPC라서). 그런데 PlanDesktop의
-- CompactTripCard/PastTripCard가 tripSummary.ts의 summarizeTrip(trip)으로
-- 완성도%·장소 수·호텔/항공 여부를 보여주면서, 빈 content를 그대로 요약해
-- 실제로 장소·호텔을 채운 여행도 전부 0/미정으로 보이는 문제가 생겼다.
-- 전체 재구성 대신 집계만 하는 가벼운 함수를 별도로 둔다.
-- ============================================================================

create or replace function public.get_trip_summaries()
returns table (
  trip_id uuid,
  planned_days int,
  place_count int,
  has_hotel boolean,
  has_flight boolean
)
language sql
stable
as $fn$
  select
    t.id as trip_id,
    count(distinct i.day_id) filter (where i.type not in ('lodging', 'flight', 'note'))::int as planned_days,
    count(i.id) filter (where i.type not in ('lodging', 'flight', 'note'))::int as place_count,
    bool_or(i.type = 'lodging') as has_hotel,
    bool_or(i.type = 'flight') as has_flight
  from public.trips t
  left join public.itinerary_items i on i.trip_id = t.id
  where t.owner_id = auth.uid()
  group by t.id
$fn$;

revoke all on function public.get_trip_summaries() from public;
grant execute on function public.get_trip_summaries() to authenticated;
