-- ============================================================================
-- 0095: 이용 정지 계정 — 운영자가 강제 탈퇴시킬 때 이메일과 사유·시각을 남기고, 같은 이메일로 다시 들어오면 막는다.
--  · 정지는 이메일(소문자) 기준. 해제하면 lifted_at이 채워지고(기록은 남김) 다시 가입·로그인할 수 있다.
--  · 표는 RLS만 켜고 정책을 만들지 않는다 — 읽기·쓰기는 아래 함수(운영자 전용)와 서버(서비스 키)로만.
--  · check_my_suspension(): 로그인한 사람이 정지된 이메일이면 사유·시각을 돌려준다. 정지 뒤에 새로 만들어진 계정이면(=정지된 사람이
--    같은 이메일로 다시 가입한 것) 그 빈 계정을 지워서 남지 않게 한다. 정지 전부터 있던 계정은 지우지 않는다.
-- ============================================================================
create table if not exists public.suspended_accounts (
  id bigint generated always as identity primary key,
  email text not null check (email = lower(email)),
  display_name text,
  reason text not null check (reason in ('abuse', 'spam', 'fraud', 'privacy', 'illegal', 'impersonation', 'terms')),
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users (id) on delete set null,
  lifted_at timestamptz,
  lifted_by uuid references auth.users (id) on delete set null
);
-- 같은 이메일의 정지는 한 번에 하나만 유효
create unique index if not exists suspended_accounts_active_email on public.suspended_accounts (email) where lifted_at is null;
alter table public.suspended_accounts enable row level security;
revoke all on public.suspended_accounts from public, anon, authenticated;

create or replace function public.admin_list_suspensions()
returns table (id bigint, email text, display_name text, reason text, suspended_at timestamptz, lifted_at timestamptz)
language plpgsql stable security definer set search_path = public, auth, pg_temp
as $fn$
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select s.id, s.email, s.display_name, s.reason, s.suspended_at, s.lifted_at
  from public.suspended_accounts s
  order by (s.lifted_at is null) desc, s.suspended_at desc
  limit 200;
end;
$fn$;
revoke all on function public.admin_list_suspensions() from public, anon;
grant execute on function public.admin_list_suspensions() to authenticated;

create or replace function public.admin_lift_suspension(p_id bigint)
returns void
language plpgsql security definer set search_path = public, auth, pg_temp
as $fn$
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.suspended_accounts
     set lifted_at = now(), lifted_by = auth.uid()
   where id = p_id and lifted_at is null;
end;
$fn$;
revoke all on function public.admin_lift_suspension(bigint) from public, anon;
grant execute on function public.admin_lift_suspension(bigint) to authenticated;

create or replace function public.check_my_suspension()
returns table (reason text, suspended_at timestamptz)
language plpgsql security definer set search_path = public, auth, pg_temp
as $fn$
declare
  v_email text;
  v_created timestamptz;
  v_reason text;
  v_at timestamptz;
begin
  if auth.uid() is null then
    return;
  end if;
  select lower(u.email), u.created_at into v_email, v_created from auth.users u where u.id = auth.uid();
  if v_email is null then
    return;
  end if;
  select s.reason, s.suspended_at into v_reason, v_at
  from public.suspended_accounts s
  where s.email = v_email and s.lifted_at is null;
  if v_reason is null then
    return;
  end if;
  -- 정지 뒤에 새로 만들어진 빈 계정만 지운다(관리자 계정·정지 전부터 있던 계정은 건드리지 않는다)
  if v_created > v_at and not public.is_admin_caller() then
    perform public.purge_user_data(auth.uid());
    delete from auth.users where id = auth.uid();
  end if;
  return query select v_reason, v_at;
end;
$fn$;
revoke all on function public.check_my_suspension() from public, anon;
grant execute on function public.check_my_suspension() to authenticated;
