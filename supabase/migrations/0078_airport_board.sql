-- ============================================================================
-- 0078: 홈 '인천공항 출·도착 전광판' — 외부 API 결과를 한 곳에 모아 두고(airport_board) 호출 횟수를 서버에서 막는다.
--  · 데이터: 인천국제공항공사 '여객기 운항 현황 조회 서비스(다국어)'(data.go.kr). 개발 계정 하루 1,000회 제한.
--  · 화면을 보는 사람이 몇 명이든 외부 호출은 3분에 한 번(출발+도착 = 2회)이어야 한다 → 함수가 갱신 권한을 먼저 받아야(claim_airport_refresh) 부른다.
--    하루 상한(기본 900회)을 넘으면 더 부르지 않고 마지막 값을 계속 보여 준다. 보는 사람이 없으면 호출도 없다(요청이 있을 때만 갱신).
--  · airport_board는 누구나 읽을 수 있고(전광판), 쓰기는 Edge Function(service_role)만. 사용량 표는 아무도 직접 못 읽는다.
-- ============================================================================

create table if not exists public.airport_board (
  id          text primary key check (id = 'incheon'),
  departures  jsonb not null default '[]'::jsonb,
  arrivals    jsonb not null default '[]'::jsonb,
  -- 외부에서 마지막으로 성공해 받은 시각(없으면 아직 한 번도 못 받음)
  fetched_at  timestamptz,
  -- 마지막으로 갱신을 시도한 시각(성공·실패 무관) — 동시에 여러 요청이 와도 한 번만 부르게 하고, 실패해도 3분은 쉰다
  attempt_at  timestamptz not null default 'epoch'
);

insert into public.airport_board (id) values ('incheon') on conflict do nothing;

alter table public.airport_board enable row level security;
drop policy if exists "public read airport board" on public.airport_board;
create policy "public read airport board" on public.airport_board for select using (true);
grant select on public.airport_board to anon, authenticated;

create table if not exists public.airport_api_usage (
  day   date primary key,
  calls integer not null default 0
);
alter table public.airport_api_usage enable row level security; -- 정책 없음: 함수(security definer)만 만진다

-- 갱신 권한 — 마지막 시도가 p_min_age보다 오래됐고 오늘 호출 수가 상한 안일 때만 true(그리고 시도 시각·오늘 사용량을 기록)
create or replace function public.claim_airport_refresh(
  p_min_age interval default interval '3 minutes',
  p_calls integer default 2,
  p_daily_limit integer default 900
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_n integer;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  update public.airport_board set attempt_at = now() where id = 'incheon' and attempt_at < now() - p_min_age;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return false;
  end if;

  insert into public.airport_api_usage (day, calls) values (v_day, p_calls)
  on conflict (day) do update set calls = public.airport_api_usage.calls + p_calls
    where public.airport_api_usage.calls + p_calls <= p_daily_limit;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$fn$;
revoke all on function public.claim_airport_refresh(interval, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_airport_refresh(interval, integer, integer) to service_role;
