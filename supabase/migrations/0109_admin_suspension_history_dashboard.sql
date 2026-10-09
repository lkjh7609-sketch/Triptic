-- ============================================================================
-- 0109: 운영 콘솔 — 정지 기록(영구 내역) + 대시보드 집계
--
-- 1) suspended_accounts는 '이용 정지 명단'이면서 정지·해제의 영구 기록이다(해제해도 행은 그대로, lifted_at만 채워진다).
--    그 약속을 코드가 아니라 DB가 지키게 한다: 행 삭제는 누구도(서비스 키 포함) 못 하고, 수정은 '해제'(lifted_at/lifted_by를 처음 채우는 것)만 된다.
--    (suspended_by/lifted_by가 가리키는 계정이 지워질 때 FK가 null로 비우는 것만 예외로 허용)
-- 2) admin_suspension_history — 정지 기록을 검색(이메일·이름·사유 글)·상태(정지 중/해제됨)·사유·정지일 기간으로 거르고 쪽 나눠 읽는다.
-- 3) admin_dashboard_stats — 운영 대시보드 숫자(대기 신고·검수 대기·정지 중·새 건의·회원·여행·최근 가입). 운영자만.
-- ============================================================================

-- ── 1) 정지 기록 보호 ───────────────────────────────────────────────────────
create or replace function public.suspended_accounts_guard()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'suspension history is permanent' using errcode = '42501';
  end if;

  if new.email is distinct from old.email
     or new.display_name is distinct from old.display_name
     or new.reason is distinct from old.reason
     or new.reason_text is distinct from old.reason_text
     or new.suspended_at is distinct from old.suspended_at then
    raise exception 'suspension record is immutable' using errcode = '42501';
  end if;
  -- 정지한 운영자 계정이 지워질 때 FK가 비우는 것만 허용
  if new.suspended_by is distinct from old.suspended_by and new.suspended_by is not null then
    raise exception 'suspension record is immutable' using errcode = '42501';
  end if;
  -- 해제는 한 번만(처음 채우는 것), 이미 해제된 기록은 바꾸지 못한다
  if old.lifted_at is not null and new.lifted_at is distinct from old.lifted_at then
    raise exception 'suspension already lifted' using errcode = '42501';
  end if;
  if old.lifted_by is not null and new.lifted_by is distinct from old.lifted_by and new.lifted_by is not null then
    raise exception 'suspension already lifted' using errcode = '42501';
  end if;
  return new;
end;
$fn$;

drop trigger if exists suspended_accounts_guard on public.suspended_accounts;
create trigger suspended_accounts_guard
  before update or delete on public.suspended_accounts
  for each row execute function public.suspended_accounts_guard();

-- 검색·정렬에 쓰는 보조 색인(기록이 쌓일수록 느려지지 않게)
create index if not exists suspended_accounts_suspended_at_idx on public.suspended_accounts (suspended_at desc);

-- ── 2) 정지 기록 조회 ───────────────────────────────────────────────────────
create or replace function public.admin_suspension_history(
  p_query text default '',
  p_status text default null,   -- 'active'(정지 중) | 'lifted'(해제됨) | null/''(전체)
  p_reason text default null,
  p_from date default null,     -- 정지일(한국 시간) 이후
  p_to date default null,       -- 정지일(한국 시간) 이전, 그날 포함
  p_offset int default 0,
  p_limit int default 20
)
returns table (
  id bigint,
  email text,
  display_name text,
  reason text,
  reason_text text,
  suspended_at timestamptz,
  lifted_at timestamptz,
  suspended_by_name text,
  lifted_by_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $fn$
declare
  q text := lower(btrim(coalesce(p_query, '')));
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return query
  select s.id, s.email, s.display_name, s.reason, s.reason_text, s.suspended_at, s.lifted_at,
         (select p.display_name from public.profiles p where p.id = s.suspended_by),
         (select p.display_name from public.profiles p where p.id = s.lifted_by),
         count(*) over ()
  from public.suspended_accounts s
  where (q = ''
         or strpos(lower(s.email), q) > 0
         or strpos(lower(coalesce(s.display_name, '')), q) > 0
         or strpos(lower(coalesce(s.reason_text, '')), q) > 0)
    and (coalesce(p_status, '') = ''
         or (p_status = 'active' and s.lifted_at is null)
         or (p_status = 'lifted' and s.lifted_at is not null))
    and (coalesce(p_reason, '') = '' or s.reason = p_reason)
    and (p_from is null or s.suspended_at >= (p_from::timestamp at time zone 'Asia/Seoul'))
    and (p_to is null or s.suspended_at < ((p_to + 1)::timestamp at time zone 'Asia/Seoul'))
  order by s.suspended_at desc, s.id desc
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$fn$;

revoke all on function public.admin_suspension_history(text, text, text, date, date, int, int) from public, anon;
grant execute on function public.admin_suspension_history(text, text, text, date, date, int, int) to authenticated;

-- ── 3) 대시보드 집계 ────────────────────────────────────────────────────────
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $fn$
declare
  kst_today timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
begin
  if not public.is_admin_caller() then
    raise exception 'admin only' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'pending_review', (select count(*) from public.posts where status = 'pending_review')
                    + (select count(*) from public.companion_posts where status = 'pending_review'),
    'suspensions_active', (select count(*) from public.suspended_accounts where lifted_at is null),
    'feedback_new', (select count(*) from public.user_feedback where status = 'new'),
    'members_total', (select count(*) from public.profiles),
    'members_today', (select count(*) from public.profiles where created_at >= kst_today),
    'members_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'trips_total', (select count(*) from public.trips where deleted_at is null),
    'trips_7d', (select count(*) from public.trips where deleted_at is null and created_at >= now() - interval '7 days'),
    -- 최근 14일(한국 날짜) 가입자 수 — 오래된 날부터
    'signups_14d', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'count', coalesce(c.n, 0)) order by d.day), '[]'::jsonb)
      from (select (kst_today + make_interval(days => g - 13))::date as day, kst_today + make_interval(days => g - 13) as start_at
            from generate_series(0, 13) g) d
      left join lateral (
        select count(*) as n from public.profiles p
        where p.created_at >= d.start_at and p.created_at < d.start_at + interval '1 day'
      ) c on true
    ),
    'recent_members', (
      select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'display_name', m.display_name, 'handle', m.handle, 'created_at', m.created_at) order by m.created_at desc), '[]'::jsonb)
      from (select id, display_name, handle, created_at from public.profiles order by created_at desc limit 5) m
    ),
    'recent_suspensions', (
      select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'email', s.email, 'reason', s.reason, 'suspended_at', s.suspended_at, 'lifted_at', s.lifted_at) order by s.suspended_at desc), '[]'::jsonb)
      from (select id, email, reason, suspended_at, lifted_at from public.suspended_accounts order by suspended_at desc limit 5) s
    )
  );
end;
$fn$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
