-- ============================================================================
-- 0088: 회원 성별·나잇대, 접속 기록, 공지·업데이트, 회원 관리 RPC (사용자 요청 2026-10-05)
--  · 성별·나잇대는 선택 입력 — 동행 모집·지원 화면에 글쓴이/지원자의 나잇대·성별을 보여 주려고 받는다.
--    다른 회원에게는 '동행 모집글을 쓰거나 동행에 지원한 사람'만 뷰(companion_member_info)로 보인다.
--  · 최근 접속·대략적 위치(국가·도시)는 서버 함수(touch_my_activity)로만 기록한다 — 정확한 위치는 모으지 않는다.
--  · 공지(announcements): 누구나 읽고(로그인 없이도), 운영자만 쓴다.
--  · 회원 관리 RPC는 함수 안에서 관리자(role='admin')를 다시 확인한다(set_post_pinned와 같은 방식).
-- ============================================================================

-- ── 1) 프로필 컬럼 ───────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists gender text,
  add column if not exists age_band text,
  add column if not exists demographics_skips integer not null default 0,
  add column if not exists last_seen_at timestamptz,
  add column if not exists last_country text,
  add column if not exists last_city text;

alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender is null or gender in ('female', 'male'));
alter table public.profiles drop constraint if exists profiles_age_band_check;
alter table public.profiles add constraint profiles_age_band_check
  check (age_band is null or age_band in ('20s_early', '20s_late', '30s_early', '30s_late', '40s', '50s_plus'));

-- 서버가 관리하는 컬럼(이용자가 직접 못 바꾼다) — 성별·나잇대는 본인이 바꿀 수 있다
create or replace function public.guard_profile_activity_columns() returns trigger
language plpgsql set search_path = public, pg_temp
as $fn$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.demographics_skips is distinct from old.demographics_skips
     or new.last_seen_at is distinct from old.last_seen_at
     or new.last_country is distinct from old.last_country
     or new.last_city is distinct from old.last_city then
    raise exception 'activity columns are server-managed' using errcode = '42501';
  end if;
  return new;
end;
$fn$;
drop trigger if exists profiles_guard_activity on public.profiles;
create trigger profiles_guard_activity before update on public.profiles
  for each row execute function public.guard_profile_activity_columns();

-- "나중에" — 두 번까지만 다시 묻는다
create or replace function public.skip_my_demographics() returns void
language sql security definer set search_path = public, pg_temp
as $fn$
  update public.profiles set demographics_skips = least(demographics_skips + 1, 10) where id = auth.uid();
$fn$;
revoke all on function public.skip_my_demographics() from public, anon;
grant execute on function public.skip_my_demographics() to authenticated;

-- 최근 접속·대략적 위치 기록(앱을 열 때 클라이언트가 가끔 부른다)
create or replace function public.touch_my_activity(p_country text default null, p_city text default null) returns void
language sql security definer set search_path = public, pg_temp
as $fn$
  update public.profiles
  set last_seen_at = now(),
      last_country = coalesce(left(nullif(btrim(p_country), ''), 2), last_country),
      last_city = coalesce(left(nullif(btrim(p_city), ''), 60), last_city)
  where id = auth.uid();
$fn$;
revoke all on function public.touch_my_activity(text, text) from public, anon;
grant execute on function public.touch_my_activity(text, text) to authenticated;

-- ── 2) 동행 활동을 하는 사람의 나잇대·성별(로그인한 회원에게만) ─────────────────────
create or replace view public.companion_member_info as
select p.id, p.gender, p.age_band
from public.profiles p
where exists (select 1 from public.companion_posts cp where cp.author_id = p.id and cp.status in ('pending_review', 'recruiting', 'matched', 'closed'))
   or exists (select 1 from public.companion_applications ca where ca.applicant_id = p.id and ca.status in ('pending', 'accepted', 'rejected'));
revoke all on public.companion_member_info from public, anon, authenticated;
grant select on public.companion_member_info to authenticated;

-- ── 3) 공지·업데이트 ─────────────────────────────────────────────────────────
create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('notice', 'update')),
  title        text not null check (char_length(title) between 1 and 100),
  body         text not null check (char_length(body) between 1 and 5000),
  version      text check (version is null or char_length(version) <= 20),
  pinned       boolean not null default false,
  published    boolean not null default true,
  published_at timestamptz not null default now(),
  created_by   uuid references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index announcements_pub_idx on public.announcements (published, pinned desc, published_at desc);
alter table public.announcements enable row level security;
create policy "read published announcements" on public.announcements for select
  using (published or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "admin write announcements" on public.announcements for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
grant select on public.announcements to anon, authenticated;
grant insert, update, delete on public.announcements to authenticated;

-- ── 4) 회원 관리(운영자 전용) ──────────────────────────────────────────────────
create or replace function public.is_admin_caller() returns boolean
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$fn$;
revoke all on function public.is_admin_caller() from public, anon;
grant execute on function public.is_admin_caller() to authenticated;

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
  last_country text, last_city text, trips_created_count int, total_count bigint
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
         p.trips_created_count, count(*) over ()
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

create or replace function public.admin_member_trips(p_user_id uuid)
returns table (id uuid, title text, city text, start_date date, end_date date, total_days int, status text, created_at timestamptz, updated_at timestamptz, deleted_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select t.id, t.title, t.city, t.start_date, t.end_date, t.total_days, t.status, t.created_at, t.updated_at, t.deleted_at
  from public.trips t where t.owner_id = p_user_id order by t.created_at desc limit 100;
end;
$fn$;
revoke all on function public.admin_member_trips(uuid) from public, anon;
grant execute on function public.admin_member_trips(uuid) to authenticated;
