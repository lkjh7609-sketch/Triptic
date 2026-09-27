-- ============================================================================
-- 0043: guard_protected_columns()의 닉네임 중복 검사가 실제로는 아무 것도
-- 막지 못하던 버그 수정
--
-- guard_protected_columns()는 SECURITY DEFINER가 아니라서(0041 주석에 적은
-- 이유 그대로 — current_user로 authenticated를 구분해야 하니까) 그 안의
-- `exists (select 1 from profiles ...)`는 호출한 사용자의 RLS 그대로 실행된다.
-- profiles의 유일한 select 정책은 "본인 행만"이라, 이 쿼리는 항상 자기
-- 자신의 행 하나만 보고 다른 사용자의 이름과는 절대 겹칠 수 없다 — 즉
-- 중복 검사가 있으나 마나였다. is_display_name_available()은 SECURITY
-- DEFINER라 RLS를 우회하므로 그걸 그대로 재사용한다.
-- ============================================================================

create or replace function public.guard_protected_columns()
returns trigger
language plpgsql
as $fn$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if TG_TABLE_NAME = 'profiles' then
    if new.role is distinct from old.role then
      raise exception 'role can only be changed by admin_set_user_plan-style RPCs';
    end if;
    if new.plan is distinct from old.plan then
      raise exception 'plan can only be changed by admin_set_user_plan()';
    end if;
    if new.trips_created_count is distinct from old.trips_created_count then
      raise exception 'trips_created_count is server-managed';
    end if;
    if new.handle is distinct from old.handle then
      raise exception 'handle is server-managed';
    end if;
    if new.display_name is distinct from old.display_name then
      if new.display_name !~ '^[가-힣]{2,7}$' then
        raise exception 'display_name must be 2-7 Hangul characters' using errcode = 'P0001', hint = 'invalid_display_name';
      end if;
      if new.display_name in ('관리자', '운영자', '트립틱') then
        raise exception 'this display name is reserved' using errcode = 'P0001', hint = 'reserved_display_name';
      end if;
      if not public.is_display_name_available(new.display_name, new.id) then
        raise exception 'display_name already taken' using errcode = 'P0001', hint = 'duplicate_display_name';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'trips' then
    if new.reopen_count is distinct from old.reopen_count then
      raise exception 'reopen_count can only be changed by reopen_trip()';
    end if;
    if new.finalized_at is distinct from old.finalized_at then
      raise exception 'finalized_at can only be changed by finalize_trip()/reopen_trip()';
    end if;
    if new.forked_from_trip_id is distinct from old.forked_from_trip_id then
      raise exception 'forked_from_trip_id is server-managed';
    end if;
  end if;
  return new;
end;
$fn$;
