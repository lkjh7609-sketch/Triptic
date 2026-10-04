-- ============================================================================
-- 0085: 공항 화면 김포·대구·김해·제주 '실시간 출·도착' — 한국공항공사 '실시간 항공기 운항정보 조회'(data.go.kr B551178/flight-status)
--  · 인천(0078 airport_board)과 같은 방식: 결과를 한 곳(kac_board)에 모아 두고, 보는 사람이 몇 명이든 3분에 한 번만 외부를 부른다.
--  · 한 번에 13개 공항이 다 오고 100줄씩 쪽으로 나뉜다(지금 −1시간 ~ +4시간이면 보통 4~6쪽) → 갱신 한 번에 쪽 수만큼 호출.
--    권한을 받을 때 6회로 미리 세고(claim_kac_board_refresh), 하루 상한(기본 5,000회)을 넘으면 더 부르지 않고 마지막 값을 보여 준다.
--  · 누구나 읽을 수 있고, 쓰기는 Edge Function(service_role)만. 사용량 표는 아무도 직접 못 읽는다.
-- ============================================================================

create table if not exists public.kac_board (
  id          text primary key check (id = 'all'),
  -- 공항 코드 → { departures, arrivals } (kacBoardParse.ts KacAirportBoard)
  boards      jsonb not null default '{}'::jsonb,
  fetched_at  timestamptz,
  attempt_at  timestamptz not null default 'epoch'
);

insert into public.kac_board (id) values ('all') on conflict do nothing;

alter table public.kac_board enable row level security;
drop policy if exists "public read kac board" on public.kac_board;
create policy "public read kac board" on public.kac_board for select using (true);
grant select on public.kac_board to anon, authenticated;

create table if not exists public.kac_board_usage (
  day   date primary key,
  calls integer not null default 0
);
alter table public.kac_board_usage enable row level security; -- 정책 없음: 함수(security definer)만 만진다

create or replace function public.claim_kac_board_refresh(
  p_min_age interval default interval '3 minutes',
  p_calls integer default 6,
  p_daily_limit integer default 5000
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_n integer;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  update public.kac_board set attempt_at = now() where id = 'all' and attempt_at < now() - p_min_age;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return false;
  end if;

  insert into public.kac_board_usage (day, calls) values (v_day, p_calls)
  on conflict (day) do update set calls = public.kac_board_usage.calls + p_calls
    where public.kac_board_usage.calls + p_calls <= p_daily_limit;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$fn$;
revoke all on function public.claim_kac_board_refresh(interval, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_kac_board_refresh(interval, integer, integer) to service_role;
