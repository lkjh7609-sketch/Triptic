-- ============================================================================
-- 0041: 보안 구멍 긴급 수정 + 핸들 자동 발급 + 닉네임 규칙 서버 강제
--
-- ⚠️ 긴급 발견: "Users can update own profile"(자기 행이면 어떤 컬럼이든 UPDATE
-- 허용, with_check 없음)과 Supabase가 모든 신규 테이블/컬럼에 자동으로 붙이는
-- authenticated 권한(이 세션에서 여러 번 확인된 패턴) 때문에, 로그인한 아무나
-- `update profiles set role='admin', plan='pro'` 를 직접 호출해 관리자 승격
-- + 무료 한도 우회가 가능했다(0037/0038과 무관하게 이전부터 있던 구멍).
-- trips.reopen_count/finalized_at도 같은 이유로 직접 덮어써서 재편집 5회
-- 제한을 우회할 수 있었다. RPC 경유 전용이어야 하는 컬럼들을 BEFORE UPDATE
-- 트리거로 막는다 — current_user로 판별해야 한다(auth.uid()는 SECURITY
-- DEFINER 함수 안에서도 "그 함수를 호출한 진짜 사용자"라 관리자 여부로
-- 판별하면 트리거 계정의 정상 여행 생성까지 막힌다; current_user는 우리
-- SECURITY DEFINER 함수 안에서는 함수 소유자로 바뀌므로 이걸로 구분한다).
-- ============================================================================

create or replace function public.guard_protected_columns()
returns trigger
language plpgsql
as $fn$
begin
  -- PostgREST로 직접 오는 요청만 'authenticated' 롤로 실행된다 — 우리
  -- SECURITY DEFINER RPC/트리거 내부의 쓰기는 함수 소유자 롤로 실행되므로
  -- 여기 안 걸린다(그래서 이 함수 자체는 SECURITY DEFINER면 안 된다).
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
      if exists (select 1 from public.profiles p where p.display_name = new.display_name and p.id <> new.id) then
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

drop trigger if exists guard_profiles_protected_columns on public.profiles;
create trigger guard_profiles_protected_columns
  before update on public.profiles
  for each row execute function public.guard_protected_columns();

drop trigger if exists guard_trips_protected_columns on public.trips;
create trigger guard_trips_protected_columns
  before update on public.trips
  for each row execute function public.guard_protected_columns();

-- ── 핸들: 가입 시 자동 발급, 5자리, 헷갈리는 문자(0/o/1/i/l) 제외 —
-- profiles_handle_check(기존 제약, ^[a-z0-9_]{3,20}$)가 소문자만 허용해서
-- 알파벳도 소문자로 맞춘다. ─────────────────────────────────────────────
create or replace function public.generate_random_handle()
returns text
language plpgsql
as $fn$
declare
  v_alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_handle text;
  v_exists boolean;
begin
  loop
    v_handle := '';
    for i in 1..5 loop
      v_handle := v_handle || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    select exists(select 1 from public.profiles where handle = v_handle) into v_exists;
    exit when not v_exists;
  end loop;
  return v_handle;
end;
$fn$;

create or replace function public.assign_handle_on_insert()
returns trigger
language plpgsql
as $fn$
begin
  if new.handle is null then
    new.handle := public.generate_random_handle();
  end if;
  return new;
end;
$fn$;

drop trigger if exists assign_handle_before_insert on public.profiles;
create trigger assign_handle_before_insert
  before insert on public.profiles
  for each row execute function public.assign_handle_on_insert();

-- 기존 가입자 백필(닉네임과 무관한 별도 값이라 한 번만 채우면 끝)
do $$
declare
  r record;
begin
  for r in select id from public.profiles where handle is null loop
    update public.profiles set handle = public.generate_random_handle() where id = r.id;
  end loop;
end $$;

-- ── 닉네임 중복확인 RPC(저장 전 클라이언트가 미리 물어보는 용도 — 실제
-- 경계는 위 guard 트리거) ──────────────────────────────────────────────────
create or replace function public.is_display_name_available(p_name text, p_exclude_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select not exists (
    select 1 from public.profiles p
    where p.display_name = p_name
      and (p_exclude_id is null or p.id <> p_exclude_id)
  );
$fn$;

revoke all on function public.is_display_name_available(text, uuid) from public;
grant execute on function public.is_display_name_available(text, uuid) to authenticated;

-- ── community_profiles 뷰 재구성: handle은 자기 자신/관리자만 봐야 하므로
-- 전체 공개 뷰에서 뺀다(뷰는 RLS를 안 타므로 여기 있으면 아무나 봄 —
-- UserProfileScreen이 실제로 @handle을 공개 렌더링하고 있었다). is_admin은
-- "관리자" 배지 표시용으로 추가한다. REPLACE로는 컬럼을 못 지워서 DROP 후
-- 재생성한다.
-- ⚠️ 이 세션 내내 get_advisors가 "community_profiles: Security Definer View"를
-- ERROR로 계속 띄웠는데 지금까지 "이 기능(전체 공개 프로필 조회)의 존재
-- 이유 자체가 SECURITY DEFINER"라고 보고 안 건드렸다 — 오늘 확인해 보니
-- Supabase가 이 뷰에도 anon/authenticated에게 INSERT/UPDATE/DELETE까지
-- 자동으로 부여해 놨다(이 세션에서 반복 확인한 자동 grant 패턴이 뷰에도
-- 적용됨). 이 뷰는 단순 뷰라 자동으로 갱신 가능(updatable)해서, 뷰를 통한
-- UPDATE가 base table(profiles)의 RLS를 우회했을 가능성이 있다. 뷰의
-- SECURITY DEFINER 성격 자체(=전체 공개 조회 허용)는 기능에 필요해서 유지하되,
-- SELECT 말고는 전부 명시적으로 회수해서 "읽기 전용 공개 뷰"로 확정한다.
drop view if exists public.community_profiles;
create view public.community_profiles as
select id, display_name, avatar_url, bio, (role = 'admin') as is_admin
from public.profiles;

revoke all on public.community_profiles from public, anon, authenticated;
grant select on public.community_profiles to authenticated, anon;
