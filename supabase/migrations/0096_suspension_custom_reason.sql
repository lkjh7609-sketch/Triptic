-- ============================================================================
-- 0096: 이용 정지 사유 '직접 입력' — reason='custom'이면 운영자가 쓴 글(reason_text, 200자까지)을 사유로 보여 준다.
--  목록·확인 함수의 반환 형태가 바뀌어 지우고 다시 만든다(0095).
-- ============================================================================
alter table public.suspended_accounts drop constraint if exists suspended_accounts_reason_check;
alter table public.suspended_accounts
  add constraint suspended_accounts_reason_check
  check (reason in ('abuse', 'spam', 'fraud', 'privacy', 'illegal', 'impersonation', 'terms', 'custom'));
alter table public.suspended_accounts add column if not exists reason_text text
  check (reason_text is null or char_length(reason_text) between 1 and 200);
alter table public.suspended_accounts drop constraint if exists suspended_accounts_custom_needs_text;
alter table public.suspended_accounts
  add constraint suspended_accounts_custom_needs_text check (reason <> 'custom' or reason_text is not null);

drop function if exists public.admin_list_suspensions();
create or replace function public.admin_list_suspensions()
returns table (id bigint, email text, display_name text, reason text, reason_text text, suspended_at timestamptz, lifted_at timestamptz)
language plpgsql stable security definer set search_path = public, auth, pg_temp
as $fn$
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select s.id, s.email, s.display_name, s.reason, s.reason_text, s.suspended_at, s.lifted_at
  from public.suspended_accounts s
  order by (s.lifted_at is null) desc, s.suspended_at desc
  limit 200;
end;
$fn$;
revoke all on function public.admin_list_suspensions() from public, anon;
grant execute on function public.admin_list_suspensions() to authenticated;

drop function if exists public.check_my_suspension();
create or replace function public.check_my_suspension()
returns table (reason text, reason_text text, suspended_at timestamptz)
language plpgsql security definer set search_path = public, auth, pg_temp
as $fn$
declare
  v_email text;
  v_created timestamptz;
  v_reason text;
  v_text text;
  v_at timestamptz;
begin
  if auth.uid() is null then
    return;
  end if;
  select lower(u.email), u.created_at into v_email, v_created from auth.users u where u.id = auth.uid();
  if v_email is null then
    return;
  end if;
  select s.reason, s.reason_text, s.suspended_at into v_reason, v_text, v_at
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
  return query select v_reason, v_text, v_at;
end;
$fn$;
revoke all on function public.check_my_suspension() from public, anon;
grant execute on function public.check_my_suspension() to authenticated;
