-- ============================================================================
-- 0061: 무료 사용자 여행 생성 한도 2개 → 5개(임시 완화), 그리고 한도를 사용자별 값으로.
--
-- 왜 사용자별 값인가: 나중에 기본 한도를 바꿔도 지금 5개로 받은 사람의 한도가 조용히 줄지 않고,
--   운영 콘솔에서 "누가 완화 한도를 적용받았는지"를 그대로 볼 수 있다.
--
-- · profiles.trip_limit — 무료 사용자가 평생 만들 수 있는 여행 수. 기본 5. 이미 있는 사용자도 5.
--   프로(pro)는 한도 없음(이 값을 보지 않는다).
-- · 값은 서버(관리자 RPC·마이그레이션)만 바꾼다 — guard_protected_columns가 사용자 직접 UPDATE를
--   막는다(막지 않으면 본인 행 UPDATE 정책으로 사용자가 자기 한도를 올릴 수 있다, 0041과 같은 구멍).
-- · admin_search_users가 여행 생성 수와 한도를 함께 돌려준다(운영 콘솔 "사용자 등급" 탭).
--   반환 컬럼이 바뀌어서 함수를 지우고 다시 만든다(0039와 같은 이유).
--
-- guard_protected_columns 전체를 다시 쓴다 — 0060(닉네임 규칙)의 변경을 그대로 포함하고 trip_limit
-- 보호만 더한다.
-- ============================================================================

alter table public.profiles add column if not exists trip_limit int not null default 5 check (trip_limit >= 0);

create or replace function public.enforce_trip_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_plan text;
  v_limit int;
  v_next_count int;
begin
  select plan, trip_limit, trips_created_count + 1 into v_plan, v_limit, v_next_count
  from public.profiles where id = new.owner_id for update;

  if v_plan = 'free' and v_next_count > v_limit then
    raise exception 'free plan trip limit reached' using errcode = 'P0001', hint = 'trip_limit_reached';
  end if;

  update public.profiles set trips_created_count = v_next_count where id = new.owner_id;
  return new;
end;
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

drop function if exists public.admin_search_users(text, int, int);

create or replace function public.admin_search_users(p_query text default '', p_offset int default 0, p_limit int default 20)
returns table (id uuid, handle text, display_name text, avatar_url text, plan text, trips_created_count int, trip_limit int)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select p.id, p.handle, p.display_name, p.avatar_url, p.plan, p.trips_created_count, p.trip_limit
  from public.profiles p
  where exists (select 1 from public.profiles admin_p where admin_p.id = auth.uid() and admin_p.role = 'admin')
    and (
      p_query = ''
      or coalesce(p.handle, '') ilike '%' || p_query || '%'
      or coalesce(p.display_name, '') ilike '%' || p_query || '%'
    )
  order by p.display_name nulls last, p.id
  limit p_limit offset p_offset;
$fn$;

revoke all on function public.admin_search_users(text, int, int) from public, anon;
grant execute on function public.admin_search_users(text, int, int) to authenticated;
