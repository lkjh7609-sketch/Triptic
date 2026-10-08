-- ============================================================================
-- 0104: 통계 탭용 여행 통계 집계 RPC
--
-- 통계 탭('다녀온 여행 모든 통계')은 여행마다 경비·장소·항공 정보가 필요한데, listTrips()는 상세 콘텐츠를 채우지 않는다
-- (여행 수만큼 get_trip_itinerary_raw를 부르면 비싸다). 서버에서 한 번에 집계해 여행당 한 객체로 돌려준다.
--
-- - 내가 소유했거나 멤버인 여행(삭제 안 된 것)만 — get_trip_summaries와 같은 기준. SECURITY INVOKER라 RLS도 그대로 적용.
-- - 경비는 여행 기본 통화로 환산한 값만 더한다(통화가 같으면 그대로, 다르면 입력 시점 환율 스냅샷으로. 스냅샷이 없으면
--   합계에서 빼고 expense_unconverted로 센다 — plan/expenses.ts convertToBase와 같은 규칙).
-- - 여행이 '지난 여행'인지·나라/대륙·원화 환산·이동 거리는 클라이언트에서 계산한다(도시 목록·현재 환율이 거기 있다).
-- ============================================================================

create or replace function public.get_travel_stats()
returns jsonb
language sql
stable
as $fn$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.start_date desc nulls last), '[]'::jsonb)
  from (
    select
      t.id as trip_id,
      t.title,
      t.city,
      t.city_lat,
      t.city_lng,
      t.start_date,
      t.end_date,
      t.total_days,
      t.base_currency,
      (select count(*) from public.trip_members m where m.trip_id = t.id)::int as member_count,
      -- 일차별로 다른 도시를 정해 둔 경우의 도시 좌표(여행 한 번에 여러 도시)
      coalesce((
        select jsonb_agg(jsonb_build_object('name', d.city_name, 'lat', d.city_lat, 'lng', d.city_lng) order by d.day_index)
        from public.trip_days d
        where d.trip_id = t.id and d.city_lat is not null and d.city_lng is not null
      ), '[]'::jsonb) as day_cities,
      -- 방문 장소(숙소·항공·메모 제외) 수와 분류별 수
      (select count(*) from public.itinerary_items i
        where i.trip_id = t.id and i.type not in ('lodging', 'flight', 'note'))::int as place_count,
      coalesce((
        select jsonb_object_agg(q.k, q.c)
        from (
          select coalesce(i.category, i.type) as k, count(*) as c
          from public.itinerary_items i
          where i.trip_id = t.id and i.type not in ('lodging', 'flight', 'note')
          group by 1
        ) q
      ), '{}'::jsonb) as place_categories,
      -- 경비(기본 통화 환산)
      ex.total as expense_total,
      coalesce(ex.unconverted, 0) as expense_unconverted,
      coalesce(ex.by_category, '{}'::jsonb) as expense_by_category,
      coalesce(ex.by_payment, '{}'::jsonb) as expense_by_payment,
      coalesce(ex.by_day, '{}'::jsonb) as expense_by_day,
      -- 항공 구간(항공사·출발/도착 공항 좌표) — 이동 거리·항공사 통계용
      coalesce((
        select jsonb_agg(i.extra -> 'flight' order by i.position)
        from public.itinerary_items i
        where i.trip_id = t.id and i.type = 'flight' and i.extra ? 'flight'
      ), '[]'::jsonb) as flights
    from public.trips t
    left join lateral (
      select
        sum(c.amt) as total,
        count(*) filter (where c.amt is null)::int as unconverted,
        (select jsonb_object_agg(g.k, g.s) from (
           select e2.category as k, sum(e2.amt) as s
           from (select e.category,
                   case when e.currency = t.base_currency then e.amount when e.fx_rate_to_base is not null then e.amount * e.fx_rate_to_base end as amt
                 from public.expenses e where e.trip_id = t.id) e2
           where e2.amt is not null group by 1) g) as by_category,
        (select jsonb_object_agg(g.k, g.s) from (
           select coalesce(e2.payment_method, 'unknown') as k, sum(e2.amt) as s
           from (select e.payment_method,
                   case when e.currency = t.base_currency then e.amount when e.fx_rate_to_base is not null then e.amount * e.fx_rate_to_base end as amt
                 from public.expenses e where e.trip_id = t.id) e2
           where e2.amt is not null group by 1) g) as by_payment,
        (select jsonb_object_agg(g.k, g.s) from (
           select coalesce(d.day_index, 0)::text as k, sum(e2.amt) as s
           from (select e.day_id,
                   case when e.currency = t.base_currency then e.amount when e.fx_rate_to_base is not null then e.amount * e.fx_rate_to_base end as amt
                 from public.expenses e where e.trip_id = t.id) e2
           left join public.trip_days d on d.id = e2.day_id
           where e2.amt is not null group by 1) g) as by_day
      from (
        select case when e.currency = t.base_currency then e.amount when e.fx_rate_to_base is not null then e.amount * e.fx_rate_to_base end as amt
        from public.expenses e where e.trip_id = t.id
      ) c
    ) ex on true
    where t.deleted_at is null
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
  ) x
$fn$;

-- 로그인한 사용자만(비로그인은 어차피 빈 결과지만 권한을 열어 둘 이유가 없다)
revoke execute on function public.get_travel_stats() from public, anon;
grant execute on function public.get_travel_stats() to authenticated;
