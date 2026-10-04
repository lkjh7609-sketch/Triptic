-- ============================================================================
-- 0091: 운영자 — 회원이 만든 여행 내용 보기(읽기 전용), 보관함 선택 삭제·비우기 (사용자 요청 2026-10-05)
--  · admin_get_trip: 일정(일차·장소·메모)·숙소·항공편을 읽는다. 예약 서류·경비는 열지 않는다(필요 최소한).
--  · 보관함 삭제: 행을 지우기 전에 그 글의 사진 파일부터 지워야 파일이 주인 없이 남지 않는다 — 저장소 삭제는 운영자 정책으로
--    클라이언트가 하고(아래 정책), 행 삭제는 admin_delete_archived가 한다.
-- ============================================================================

create or replace function public.admin_get_trip(p_trip_id uuid)
returns json
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
                from public.itinerary_items where trip_id = p_trip_id) i),
    'hotels', (select coalesce(json_agg(h order by h.day), '[]'::json) from (
                select id, day, name, address from public.hotels where trip_id = p_trip_id) h),
    'flights', (select coalesce(json_agg(f), '[]'::json) from (
                select id, type, flight_no, airline, dep_iata, dep_name, dep_time, arr_iata, arr_name, arr_time
                from public.flights where trip_id = p_trip_id) f)
  ) into result;
  return result;
end;
$fn$;
revoke all on function public.admin_get_trip(uuid) from public, anon;
grant execute on function public.admin_get_trip(uuid) to authenticated;

-- 보관함 — 지울 글들의 사진 경로(null이면 전부)
create or replace function public.admin_archive_image_paths(p_ids bigint[] default null)
returns text[]
language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return coalesce((
    select array_agg(distinct i->>'storage_path')
    from public.archived_content a, jsonb_array_elements(coalesce(a.children->'post_images', '[]'::jsonb)) i
    where (p_ids is null or a.id = any (p_ids)) and i->>'storage_path' is not null
  ), '{}');
end;
$fn$;
revoke all on function public.admin_archive_image_paths(bigint[]) from public, anon;
grant execute on function public.admin_archive_image_paths(bigint[]) to authenticated;

-- 보관함 행 삭제(null이면 전부 비우기) — 지운 행 수
create or replace function public.admin_delete_archived(p_ids bigint[] default null)
returns int
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  n int;
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  with gone as (
    delete from public.archived_content a where p_ids is null or a.id = any (p_ids) returning 1
  )
  select count(*)::int into n from gone;
  return n;
end;
$fn$;
revoke all on function public.admin_delete_archived(bigint[]) from public, anon;
grant execute on function public.admin_delete_archived(bigint[]) to authenticated;

-- 운영자는 게시 사진 파일을 지울 수 있다(보관함 비우기용)
drop policy if exists "admin delete post images" on storage.objects;
create policy "admin delete post images" on storage.objects for delete
  using (bucket_id = 'post-images' and public.is_admin_caller());
