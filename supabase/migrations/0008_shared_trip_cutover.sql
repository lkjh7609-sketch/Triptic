-- ============================================================================
-- 0008: 공유 링크 조회 함수 — 정규화 테이블용 get_shared_trip 교체
-- 출처: docs/specs/03-data-model.md §4.4
--
-- 🛑 이 파일은 다른 0xxx 파일과 같은 타이밍에 적용하면 안 된다.
-- 현재 운영 중인 get_shared_trip(text)는 trips.snapshot에서 데이터를 읽는다.
-- 이 파일은 그것을 itinerary_items/trip_days/legs(정규화 테이블)에서 읽도록
-- **완전히 대체**한다. 정규화 테이블에 실제 데이터가 채워지기 전(§6 M4 완료 전)에
-- 이 함수를 적용하면, 이미 배포된 모든 공유 링크가 즉시 빈 일정을 반환하게 된다.
--
-- 적용 순서 (03-data-model.md §6):
--   M0 백업 → M1(0001~0007 테이블/RLS) → M2 변환 함수 배포 → M3 검증(0행 확인)
--   → M4 전체 배치 마이그레이션 완료 → 그 다음에야 이 파일(0008)을 적용한다.
-- 이 저장소의 이번 커밋 시점에는 M4가 실행되지 않았으므로 0008은 적용 보류 상태다.
-- ============================================================================

create or replace function public.get_shared_trip(p_share_code text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_trip_id uuid; result json;
begin
  select st.trip_id into v_trip_id
  from public.shared_trips st
  join public.trips t on t.id = st.trip_id and t.deleted_at is null
  where st.share_code = p_share_code
    and (st.expires_at is null or st.expires_at > now())
  order by st.created_at desc limit 1;

  if v_trip_id is null then return null; end if;

  -- ⚠️ bookings/documents는 절대 포함하지 않는다. 링크를 가진 누구나 여권번호를 보게 된다.
  select json_build_object(
    'trip',  (select row_to_json(x) from (
                select id, title, start_date, end_date, base_currency
                from public.trips where id = v_trip_id) x),
    'days',  (select coalesce(json_agg(d order by d.day_index), '[]'::json)
                from public.trip_days d where d.trip_id = v_trip_id),
    'items', (select coalesce(json_agg(i order by i.position), '[]'::json)
                from public.itinerary_items i where i.trip_id = v_trip_id),
    'legs',  (select coalesce(json_agg(l), '[]'::json)
                from public.legs l where l.trip_id = v_trip_id)
  ) into result;

  update public.shared_trips
     set view_count = view_count + 1, last_viewed_at = now()
   where share_code = p_share_code;

  return result;
end;
$fn$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
