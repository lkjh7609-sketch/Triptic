-- ============================================================================
-- 0094 (초안 — 아직 적용하지 않음) 2.x 레거시 테이블·함수 정리
--
--  지우는 것: expenses_legacy_unused_v2, suggestions, places, hotels, flights, get_trip_full_data()
--  먼저 고치는 것: admin_get_trip()이 hotels·flights를 읽던 부분을 뺀다(응답에서 'hotels'·'flights' 키 삭제)
--
--  ★ 적용 순서: ① 클라이언트(0094_client_admin_trip_viewer.patch)를 먼저 배포 → ② 이 SQL 적용.
--    SQL을 먼저 적용하면 옛 클라이언트의 운영 '회원 여행 보기'가 data.flights.length에서 오류를 낸다.
--  ★ 적용 전 확인(2026-10-06 조사 기준 모두 통과):
--    · 위 5개 테이블 0행, 쓰기 이력 0(suggestions만 1건 넣고 1건 삭제), 다른 테이블이 이 테이블을 FK로 참조하지 않음
--    · 이 테이블을 읽는 뷰·realtime publication·storage 정책 없음, 트리거는 places의 updated_at 하나뿐(테이블과 함께 사라짐)
--    · 이 테이블을 읽는 DB 함수는 admin_get_trip, get_trip_full_data 둘뿐
--    · get_trip_full_data는 앱·Edge Function 어디서도 호출하지 않고, 이미 없어진 trips.user_id를 참조해 호출해도 오류가 난다
--  ★ 되돌리기: 테이블이 전부 비어 있어 데이터 손실은 없다. 구조는 0001~0005 마이그레이션과
--    git 태그/이력에서 복원한다.
-- ============================================================================

-- ── 1) admin_get_trip: hotels·flights 제거(나머지는 그대로) ─────────────────────
create or replace function public.admin_get_trip(p_trip_id uuid) returns json
language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  result json;
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select json_build_object(
    'trip', (select row_to_json(x) from (
               select t.id, t.owner_id, t.title, t.city, t.start_date, t.end_date, t.total_days, t.base_currency,
                      t.created_at, t.updated_at, t.deleted_at, p.display_name as owner_name, p.handle as owner_handle,
                      (select count(*) from public.trip_members m where m.trip_id = t.id) as member_count
               from public.trips t left join public.profiles p on p.id = t.owner_id
               where t.id = p_trip_id) x),
    'days', (select coalesce(json_agg(d order by d.day_index), '[]'::json) from public.trip_days d where d.trip_id = p_trip_id),
    'items', (select coalesce(json_agg(i order by i.position), '[]'::json) from (
                select id, day_id, position, type, title, subtitle, category, address, start_local, end_local, memo
                from public.itinerary_items where trip_id = p_trip_id) i)
  ) into result;
  return result;
end;
$fn$;
-- create or replace는 기존 권한(authenticated·service_role 실행)을 그대로 둔다.

-- ── 2) 호출하는 곳이 없고 깨진 2.x 함수 ────────────────────────────────────────
drop function if exists public.get_trip_full_data(uuid);

-- ── 3) 레거시 테이블(정책·인덱스·트리거는 테이블과 함께 지워진다) ──────────────
drop table if exists public.expenses_legacy_unused_v2;
drop table if exists public.suggestions;
drop table if exists public.places;
drop table if exists public.hotels;
drop table if exists public.flights;
