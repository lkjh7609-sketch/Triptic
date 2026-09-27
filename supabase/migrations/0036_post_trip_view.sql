-- ============================================================================
-- 0036: 커뮤니티 글에 첨부된 내 일정을 다른 사람이 읽기 전용으로 보고,
-- 마음에 들면 자기 계정으로 복제(포크)할 수 있게 한다.
--
-- posts.trip_id는 ComposePostScreen에 이미 있었지만(작성 시 내 일정 첨부)
-- 어디서도 읽지 않아 아무 효과가 없었다 — get_shared_trip()(0008, 공유
-- 링크용)과 같은 모양의 payload를 돌려주는 별도 RPC를 새로 둔다. 공유
-- 링크(shared_trips.share_code)와는 별개 경로다 — 이건 "이미 공개된 글에
-- 달린 일정"이라 별도 비밀 코드가 필요 없고, 대신 글이 published 상태일
-- 때만 보인다(모더레이션으로 숨겨지면 같이 숨는다).
-- ============================================================================

alter table public.trips add column if not exists forked_from_trip_id uuid references public.trips(id) on delete set null;

create or replace function public.get_post_trip(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_trip_id uuid;
  result json;
begin
  select p.trip_id into v_trip_id
  from public.posts p
  where p.id = p_post_id and p.status = 'published';

  if v_trip_id is null then return null; end if;

  -- get_shared_trip과 동일한 최소 노출 원칙 — expenses/documents/bookings는 절대 포함하지 않는다.
  select json_build_object(
    'trip',  (select row_to_json(x) from (
                select id, title, city, city_lat, city_lng, start_date, end_date, total_days, base_currency
                from public.trips where id = v_trip_id) x),
    'days',  (select coalesce(json_agg(d order by d.day_index), '[]'::json)
                from public.trip_days d where d.trip_id = v_trip_id),
    'items', (select coalesce(json_agg(i order by i.position), '[]'::json)
                from public.itinerary_items i where i.trip_id = v_trip_id),
    'legs',  (select coalesce(json_agg(l), '[]'::json)
                from public.legs l where l.trip_id = v_trip_id)
  ) into result;

  return result;
end;
$fn$;

revoke all on function public.get_post_trip(uuid) from public;
grant execute on function public.get_post_trip(uuid) to authenticated;
