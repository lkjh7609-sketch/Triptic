-- ============================================================================
-- 0084: 공항 화면 '주차장 남은 대수·혼잡도' — 외부 API 결과를 한 곳에 모아 두고(airport_parking) 호출 횟수를 서버에서 막는다.
--  · 데이터(data.go.kr, 키는 서버 시크릿 DATA_GO_KR_KEY): 한국공항공사 '전국공항 실시간 주차정보'·'주차장 혼잡도'(13개 공항 25곳),
--    인천국제공항공사 '주차 정보'(T1·T2 층별 19곳). 셋 다 1분마다 바뀐다.
--  · 보는 사람이 몇 명이든 외부 호출은 2분에 한 번(3개 API = 3회)이어야 한다 → 함수가 갱신 권한을 먼저 받아야(claim_parking_refresh) 부른다.
--    하루 상한(기본 2,400회 = 2분 × 3회 × 24시간 2,160회 + 여유)을 넘으면 더 부르지 않고 마지막 값을 계속 보여 준다.
--  · 출처마다 마지막으로 잘 받은 값을 따로 둔다(kac / icn) — 한쪽이 실패해도 다른 공항이 비지 않게.
--  · 누구나 읽을 수 있고, 쓰기는 Edge Function(service_role)만. 사용량 표는 아무도 직접 못 읽는다.
-- ============================================================================

create table if not exists public.airport_parking (
  id              text primary key check (id = 'all'),
  -- 한국공항공사 주차장 목록(parkingParse.ts ParkingLot[])
  kac             jsonb not null default '[]'::jsonb,
  kac_fetched_at  timestamptz,
  -- 인천국제공항공사 주차장 목록
  icn             jsonb not null default '[]'::jsonb,
  icn_fetched_at  timestamptz,
  -- 마지막으로 갱신을 시도한 시각(성공·실패 무관) — 동시에 여러 요청이 와도 한 번만 부르게 하고, 실패해도 2분은 쉰다
  attempt_at      timestamptz not null default 'epoch'
);

insert into public.airport_parking (id) values ('all') on conflict do nothing;

alter table public.airport_parking enable row level security;
drop policy if exists "public read airport parking" on public.airport_parking;
create policy "public read airport parking" on public.airport_parking for select using (true);
grant select on public.airport_parking to anon, authenticated;

create table if not exists public.airport_parking_usage (
  day   date primary key,
  calls integer not null default 0
);
alter table public.airport_parking_usage enable row level security; -- 정책 없음: 함수(security definer)만 만진다

-- 갱신 권한 — 마지막 시도가 p_min_age보다 오래됐고 오늘 호출 수가 상한 안일 때만 true(그리고 시도 시각·오늘 사용량을 기록)
create or replace function public.claim_parking_refresh(
  p_min_age interval default interval '2 minutes',
  p_calls integer default 3,
  p_daily_limit integer default 2400
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_n integer;
  v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  update public.airport_parking set attempt_at = now() where id = 'all' and attempt_at < now() - p_min_age;
  get diagnostics v_n = row_count;
  if v_n = 0 then
    return false;
  end if;

  insert into public.airport_parking_usage (day, calls) values (v_day, p_calls)
  on conflict (day) do update set calls = public.airport_parking_usage.calls + p_calls
    where public.airport_parking_usage.calls + p_calls <= p_daily_limit;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$fn$;
revoke all on function public.claim_parking_refresh(interval, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_parking_refresh(interval, integer, integer) to service_role;
