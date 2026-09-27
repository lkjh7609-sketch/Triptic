-- ============================================================================
-- 0039: 운영 콘솔 "사용자 등급" 탭 — 검색 전에도 전체 사용자를 20명씩
-- 페이지네이션으로 보여준다(p_query=''면 전체, 아니면 handle/display_name
-- 부분일치). 시그니처가 바뀌어서(오프셋/리밋 추가) 기존 admin_search_users
-- (text)는 먼저 지운다 — 안 지우면 오버로드로 둘 다 남아 클라이언트가
-- 어느 쪽을 부르는지 헷갈린다.
-- ============================================================================

drop function if exists public.admin_search_users(text);

create or replace function public.admin_search_users(p_query text default '', p_offset int default 0, p_limit int default 20)
returns table (id uuid, handle text, display_name text, avatar_url text, plan text)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select p.id, p.handle, p.display_name, p.avatar_url, p.plan
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

revoke all on function public.admin_search_users(text, int, int) from public;
grant execute on function public.admin_search_users(text, int, int) to authenticated;
