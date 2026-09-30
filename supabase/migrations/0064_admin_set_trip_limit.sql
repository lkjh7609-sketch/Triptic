-- ============================================================================
-- 0064: 운영 콘솔에서 사용자별 무료 여행 생성 한도를 직접 정한다.
--
-- admin_set_trip_limit(사용자, 한도) — 관리자만(함수 안에서 profiles.role='admin' 확인), 0~1000.
-- SECURITY DEFINER라 사용자 직접 UPDATE를 막는 guard_protected_columns(0061)를 거치지 않는다 — 그래서 함수 안의 관리자 확인이 유일한 문이다.
-- 앱은 현재 한도에서 계산한 "새 한도"를 넘긴다(더하기가 아니라 값 지정 — 동시에 두 번 눌러도 이중으로 늘지 않는다).
--
-- 같이 정리: 관리자 함수 세 개(등급 변경·건의 목록·건의 처리)의 비로그인(anon) 실행 권한을 회수한다.
-- 어차피 함수 안에서 관리자를 확인하지만, 로그인하지 않은 호출은 아예 못 닿게 한다.
-- ============================================================================

create or replace function public.admin_set_trip_limit(p_user_id uuid, p_limit int)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 0 or p_limit > 1000 then
    raise exception 'invalid limit: %', p_limit using errcode = '22023';
  end if;
  update public.profiles set trip_limit = p_limit where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;
  return p_limit;
end;
$fn$;

revoke all on function public.admin_set_trip_limit(uuid, int) from public, anon;
grant execute on function public.admin_set_trip_limit(uuid, int) to authenticated;

revoke execute on function public.admin_set_user_plan(uuid, text) from anon;
revoke execute on function public.admin_list_feedback(int, int) from anon;
revoke execute on function public.admin_mark_feedback_reviewed(uuid) from anon;
