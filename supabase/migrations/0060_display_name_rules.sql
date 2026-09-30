-- ============================================================================
-- 0060: 닉네임 규칙을 언어와 무관하게 — 한글 2~7자만 허용하던 것을 문자·숫자 2~16자로.
--
-- 왜: 첫 방문 언어를 접속 국가로 정하는데(한국→한국어, 일본→일본어, 대만→번체, 그 외→영어),
--   이름은 한글만 받아서 영어·일본어·번체 사용자는 이름을 바꿀 수 없었다.
--
-- 새 규칙(서버가 진짜 경계, 화면은 같은 규칙을 미리 알려 줄 뿐):
--   · 글자 수 2~16 (글자 = 유니코드 문자·숫자 하나)
--   · 문자·숫자로 시작하고 끝난다. 가운데는 문자·숫자·공백·점·밑줄·하이픈
--   · 공백은 연달아 둘 이상 안 됨
--   · 예약어(관리자·운영자·admin·triptic 등)는 대소문자·구분 기호를 무시하고 막는다
--   · 중복 확인은 대소문자를 구분하지 않는다("Ben"과 "ben"은 같은 이름)
--
-- 이미 있는 이름(한글 2~7자, 가입 때 소셜 계정에서 가져온 이름)은 손대지 않는다 — 이 검사는 이름을
-- 바꿀 때만 걸린다.
--
-- guard_protected_columns에 search_path를 고정한다(보안 점검 지적). 이 함수는 호출자 권한으로
-- 돌아야 해서(current_user로 사용자 직접 호출과 내부 RPC를 구분) SECURITY DEFINER로 만들지 않는다.
-- ============================================================================

create or replace function public.is_display_name_available(p_name text, p_exclude_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select not exists (
    select 1 from public.profiles p
    where lower(p.display_name) = lower(p_name)
      and (p_exclude_id is null or p.id <> p_exclude_id)
  );
$fn$;

create or replace function public.guard_protected_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
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
      if new.display_name is null
         or char_length(new.display_name) not between 2 and 16
         or new.display_name !~ '^[[:alnum:]][[:alnum:] ._-]*[[:alnum:]]$'
         or new.display_name like '%  %' then
        raise exception 'display_name must be 2-16 letters or numbers' using errcode = 'P0001', hint = 'invalid_display_name';
      end if;
      if lower(regexp_replace(new.display_name, '[ ._-]', '', 'g')) = any (array[
           '관리자', '운영자', '운영팀', '고객센터', '트립틱',
           'admin', 'administrator', 'moderator', 'mod', 'triptic', 'support', 'staff', 'official'
         ]) then
        raise exception 'this display name is reserved' using errcode = 'P0001', hint = 'reserved_display_name';
      end if;
      if not public.is_display_name_available(new.display_name, new.id) then
        raise exception 'display_name already taken' using errcode = 'P0001', hint = 'duplicate_display_name';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'trips' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'owner_id cannot be changed';
    end if;
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
$function$;
