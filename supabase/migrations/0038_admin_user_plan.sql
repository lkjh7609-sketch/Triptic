-- ============================================================================
-- 0038: 운영 콘솔에서 특정 사용자에게 유료(pro) 등급을 수동으로 부여/회수.
-- profiles에는 관리자가 남의 행을 볼/고칠 수 있는 RLS가 전혀 없어서(자기
-- 것만 select/update 가능) 검색과 변경 둘 다 SECURITY DEFINER RPC로 연다 —
-- 대신 함수 안에서 매번 auth.uid()가 role='admin'인지 직접 확인한다.
-- ============================================================================

create or replace function public.admin_search_users(p_query text)
returns table (id uuid, handle text, display_name text, avatar_url text, plan text)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select p.id, p.handle, p.display_name, p.avatar_url, p.plan
  from public.profiles p
  where exists (select 1 from public.profiles admin_p where admin_p.id = auth.uid() and admin_p.role = 'admin')
    and (p.handle ilike '%' || p_query || '%' or p.display_name ilike '%' || p_query || '%')
  order by p.display_name nulls last
  limit 20;
$fn$;

create or replace function public.admin_set_user_plan(p_user_id uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_plan not in ('free', 'pro') then
    raise exception 'invalid plan: %', p_plan;
  end if;

  update public.profiles set plan = p_plan where id = p_user_id;
  if not found then
    raise exception 'user not found';
  end if;
end;
$fn$;

revoke all on function public.admin_search_users(text) from public;
grant execute on function public.admin_search_users(text) to authenticated;
revoke all on function public.admin_set_user_plan(uuid, text) from public;
grant execute on function public.admin_set_user_plan(uuid, text) to authenticated;
