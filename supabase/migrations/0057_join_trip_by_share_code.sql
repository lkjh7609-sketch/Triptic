-- ============================================================================
-- 0057: 공유 링크 = 로그인 후 편집 멤버로 참여
--
-- 예전 공유 링크(/shared/:code)는 로그인 없이 보는 읽기 전용 뷰어였다(get_shared_trip,
-- anon 허용). 이제 링크를 연 사람은 로그인해야 하고, 로그인하면 그 여행의 편집 멤버
-- (trip_members role='editor')로 들어가 소유자와 같은 여행 화면에서 함께 편집한다.
-- trip_members INSERT 정책은 소유자 전용이라 SECURITY DEFINER 함수로 가입시킨다.
-- - 코드가 없거나 만료됐거나 여행이 삭제됐으면 null
-- - 소유자가 자기 링크를 열면 가입 없이 trip_id만 돌려준다
-- - 이미 멤버면 역할을 바꾸지 않는다(여러 번 열어도 같은 결과)
-- 링크를 끊어도(shared_trips 삭제) 이미 참여한 멤버는 남는다 — 새 참여만 막힌다.
-- ============================================================================

create or replace function public.join_trip_by_share_code(p_share_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_trip_id uuid;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'login required' using errcode = 'P0001', hint = 'login_required';
  end if;

  select st.trip_id, t.owner_id into v_trip_id, v_owner
  from public.shared_trips st
  join public.trips t on t.id = st.trip_id and t.deleted_at is null
  where st.share_code = p_share_code
    and (st.expires_at is null or st.expires_at > now())
  order by st.created_at desc
  limit 1;

  if v_trip_id is null then
    return null;
  end if;

  if v_owner <> v_uid then
    insert into public.trip_members (trip_id, user_id, role)
    values (v_trip_id, v_uid, 'editor')
    on conflict (trip_id, user_id) do nothing;
  end if;

  return v_trip_id;
end;
$fn$;

revoke all on function public.join_trip_by_share_code(text) from public, anon, authenticated;
grant execute on function public.join_trip_by_share_code(text) to authenticated;

-- 비로그인 읽기 전용 뷰어가 없어졌다 — 코드만 알면 누구나 일정을 읽던 경로를 닫는다
revoke execute on function public.get_shared_trip(text) from anon;
