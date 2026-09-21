-- ============================================================================
-- 0018: 정규화 테이블을 1차 데이터로 쓰기 위한 원자적 read/write RPC
-- 출처: ADR-002 M7 준비 (docs/specs/03-data-model.md §6.2)
--
-- trips.snapshot을 drop하려면 그 전에 Plan 탭(3.0)과 레거시 앱이 정규화
-- 테이블(trip_days/itinerary_items/legs/expenses)을 1차 데이터로 읽고 써야
-- 한다. 이 파일은 그 컷오버에 필요한 두 조각을 추가한다:
--   1) itinerary_items.extra — 항공편 도착 공항 등 구조화 컬럼에 자리가
--      없는 필드를 원본 그대로 보존(무손실 읽기 재구성용).
--   2) replace_trip_itinerary(...) — trip-itinerary-write Edge Function이
--      계산한 결과를 한 번의 트랜잭션으로 원자적으로 반영하는 함수.
--   3) get_trip_itinerary_raw(...) — 정규화 테이블을 그대로 JSON으로 반환
--      (재구성은 클라이언트 공용 모듈에서 수행 — get_shared_trip과 동일한
--      "SQL은 raw만, 재구성은 TS" 분리 패턴).
-- ============================================================================

alter table public.itinerary_items add column if not exists extra jsonb;

-- ── 쓰기: 한 트립의 파생 테이블 전체를 원자적으로 교체 ──────────────────────
create or replace function public.replace_trip_itinerary(
  p_trip_id uuid,
  p_days jsonb,
  p_items jsonb,
  p_legs jsonb,
  p_expenses jsonb
) returns void
language plpgsql
as $fn$
declare
  v_day jsonb;
  v_item jsonb;
  v_leg jsonb;
  v_exp jsonb;
  v_day_id uuid;
  v_item_id uuid;
  day_id_map jsonb := '{}'::jsonb;
  item_id_map jsonb := '{}'::jsonb;
begin
  if not public.can_edit_trip(p_trip_id) then
    raise exception 'access denied to trip %', p_trip_id;
  end if;

  delete from public.expenses where trip_id = p_trip_id;
  -- trip_days 삭제가 itinerary_items(on delete cascade)를, 그게 다시
  -- legs(on delete cascade)를 연쇄 삭제한다 — 0003/0004 FK 정의 참고.
  delete from public.trip_days where trip_id = p_trip_id;

  for v_day in select * from jsonb_array_elements(p_days) loop
    insert into public.trip_days (trip_id, day_index, date, city_name, city_lat, city_lng, timezone)
    values (
      p_trip_id,
      (v_day->>'day_index')::int,
      (v_day->>'date')::date,
      v_day->>'city_name',
      (v_day->>'city_lat')::double precision,
      (v_day->>'city_lng')::double precision,
      v_day->>'timezone'
    )
    returning id into v_day_id;
    day_id_map := day_id_map || jsonb_build_object(v_day->>'day_index', v_day_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_day_id := (day_id_map->>(v_item->>'day_index'))::uuid;
    insert into public.itinerary_items (
      trip_id, day_id, position, type, title, subtitle, category, google_place_id,
      lat, lng, address, country_code, start_local, timezone, start_at, memo, extra, created_by
    )
    values (
      p_trip_id, v_day_id,
      (v_item->>'position')::int,
      v_item->>'type', v_item->>'title', v_item->>'subtitle', v_item->>'category',
      v_item->>'google_place_id',
      (v_item->>'lat')::double precision, (v_item->>'lng')::double precision,
      v_item->>'address', v_item->>'country_code',
      v_item->>'start_local', v_item->>'timezone',
      (v_item->>'start_at')::timestamptz, v_item->>'memo',
      v_item->'extra', auth.uid()
    )
    returning id into v_item_id;
    item_id_map := item_id_map || jsonb_build_object(
      (v_item->>'day_index') || ':' || (v_item->>'position'), v_item_id::text
    );
  end loop;

  for v_leg in select * from jsonb_array_elements(p_legs) loop
    insert into public.legs (trip_id, from_item_id, to_item_id, mode, distance_m, duration_s, is_estimate, provider)
    values (
      p_trip_id,
      (item_id_map->>((v_leg->>'day_index') || ':' || (v_leg->>'from_position')))::uuid,
      (item_id_map->>((v_leg->>'day_index') || ':' || (v_leg->>'to_position')))::uuid,
      coalesce(v_leg->>'mode', 'unknown'),
      (v_leg->>'distance_m')::int,
      (v_leg->>'duration_s')::int,
      coalesce((v_leg->>'is_estimate')::boolean, true),
      coalesce(v_leg->>'provider', 'haversine')
    )
    on conflict (from_item_id, to_item_id, mode) do nothing;
  end loop;

  for v_exp in select * from jsonb_array_elements(p_expenses) loop
    v_day_id := nullif(day_id_map->>(v_exp->>'day_index'), '')::uuid;
    insert into public.expenses (trip_id, day_id, category, description, amount, currency, fx_rate_to_base, payment_method)
    values (
      p_trip_id, v_day_id,
      coalesce(v_exp->>'category', 'other'),
      v_exp->>'description',
      (v_exp->>'amount')::numeric,
      v_exp->>'currency',
      (v_exp->>'fx_rate_to_base')::numeric,
      v_exp->>'payment_method'
    );
  end loop;
end;
$fn$;

revoke all on function public.replace_trip_itinerary(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_trip_itinerary(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ── 읽기: 정규화 테이블 원본을 그대로 JSON으로 반환(재구성은 클라이언트) ────
create or replace function public.get_trip_itinerary_raw(p_trip_id uuid)
returns json
language sql
stable
as $fn$
  select json_build_object(
    'days', (select coalesce(json_agg(d order by d.day_index), '[]'::json)
               from public.trip_days d where d.trip_id = p_trip_id),
    'items', (select coalesce(json_agg(i order by i.day_id, i.position), '[]'::json)
               from public.itinerary_items i where i.trip_id = p_trip_id),
    'legs', (select coalesce(json_agg(l), '[]'::json)
               from public.legs l where l.trip_id = p_trip_id),
    'expenses', (select coalesce(json_agg(e), '[]'::json)
               from public.expenses e where e.trip_id = p_trip_id)
  );
$fn$;

revoke all on function public.get_trip_itinerary_raw(uuid) from public;
grant execute on function public.get_trip_itinerary_raw(uuid) to authenticated;
