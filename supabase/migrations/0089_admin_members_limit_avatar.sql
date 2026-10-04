-- ============================================================================
-- 0089: 회원 목록 RPC에 무료 여행 한도·아바타 컬럼 추가 (0088의 admin_list_members 반환 형태 변경)
--  운영 '회원' 탭이 한 줄에서 등급·한도 조정(기존 AdminUserPlanRow)까지 쓰도록.
-- ============================================================================
drop function if exists public.admin_list_members(text, text, text, text, date, date, int, int);

create or replace function public.admin_list_members(
  p_query text default '',
  p_gender text default null,
  p_age_band text default null,
  p_plan text default null,
  p_joined_from date default null,
  p_joined_to date default null,
  p_offset int default 0,
  p_limit int default 20
) returns table (
  id uuid, display_name text, handle text, email text, plan text, gender text, age_band text,
  created_at timestamptz, last_sign_in_at timestamptz, last_seen_at timestamptz,
  last_country text, last_city text, trips_created_count int, trip_limit int, avatar_url text, total_count bigint
)
language plpgsql stable security definer set search_path = public, auth, pg_temp
as $fn$
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select p.id, p.display_name, p.handle, u.email::text, p.plan, p.gender, p.age_band,
         p.created_at, u.last_sign_in_at, p.last_seen_at, p.last_country, p.last_city,
         p.trips_created_count, p.trip_limit, p.avatar_url, count(*) over ()
  from public.profiles p
  left join auth.users u on u.id = p.id
  where (coalesce(p_query, '') = ''
         or coalesce(p.display_name, '') ilike '%' || p_query || '%'
         or coalesce(p.handle, '') ilike '%' || p_query || '%'
         or coalesce(u.email, '') ilike '%' || p_query || '%')
    and (p_gender is null or (p_gender = 'none' and p.gender is null) or p.gender = p_gender)
    and (p_age_band is null or (p_age_band = 'none' and p.age_band is null) or p.age_band = p_age_band)
    and (p_plan is null or p.plan = p_plan)
    and (p_joined_from is null or p.created_at >= p_joined_from)
    and (p_joined_to is null or p.created_at < p_joined_to + 1)
  order by p.created_at desc, p.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$fn$;
revoke all on function public.admin_list_members(text, text, text, text, date, date, int, int) from public, anon;
grant execute on function public.admin_list_members(text, text, text, text, date, date, int, int) to authenticated;
