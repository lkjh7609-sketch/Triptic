-- ============================================================================
-- 0062: 닉네임 글자 수를 쓰는 글자(언어)별로 — 한글 4~8자, 영어 4~12자, 일본어 4~12자, 중국어 2~6자.
--
-- 어떤 글자로 쓴 이름인지는 앞에서부터 우선순위로 정한다:
--   한글이 하나라도 있으면 → 한글 이름 (4~8자)
--   아니면 가나(히라가나·가타카나)가 있으면 → 일본어 이름 (4~12자)
--   아니면 한자가 있으면 → 중국어 이름 (2~6자)
--   그 밖(영문·숫자 등) → 영어 이름 (4~12자)
-- 글자 수는 이름 전체(숫자·공백·구분 기호 포함)로 센다. 문자 구성 규칙(0060)은 그대로.
--
-- 이미 있는 이름은 손대지 않는다(이름을 바꿀 때만 검사) — 예전에 만든 3자 한글 이름은 그대로 쓸 수 있다.
-- 화면(src/shared/displayName.ts)이 같은 구분·같은 범위를 쓴다. 실제 경계는 이 함수.
-- 0061의 guard_protected_columns 전체를 다시 쓰고, 이름 검사만 이 함수를 부르게 바꾼다.
-- ============================================================================

create or replace function public.is_valid_display_name(p_name text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select p_name is not null
    and p_name ~ '^[[:alnum:]][[:alnum:] ._-]*[[:alnum:]]$'
    and p_name not like '%  %'
    and char_length(p_name) between
      (case
         when p_name ~ '[ᄀ-ᇿ㄰-㆏가-힣]' then 4
         when p_name ~ '[぀-ヿㇰ-ㇿｦ-ﾟ]' then 4
         when p_name ~ '[㐀-䶿一-鿿豈-﫿]' then 2
         else 4
       end)
      and
      (case
         when p_name ~ '[ᄀ-ᇿ㄰-㆏가-힣]' then 8
         when p_name ~ '[぀-ヿㇰ-ㇿｦ-ﾟ]' then 12
         when p_name ~ '[㐀-䶿一-鿿豈-﫿]' then 6
         else 12
       end);
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
    if new.trip_limit is distinct from old.trip_limit then
      raise exception 'trip_limit is server-managed';
    end if;
    if new.handle is distinct from old.handle then
      raise exception 'handle is server-managed';
    end if;
    if new.display_name is distinct from old.display_name then
      if not public.is_valid_display_name(new.display_name) then
        raise exception 'display_name length or characters not allowed' using errcode = 'P0001', hint = 'invalid_display_name';
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
