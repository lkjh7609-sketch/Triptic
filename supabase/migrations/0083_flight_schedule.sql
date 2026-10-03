-- ============================================================================
-- 0083: 항공편 자동입력 — 인천공항 정기편 시즌 스케줄(icn_flight_schedule) + 한국공항공사 조회 결과 보관(flight_lookup_cache).
--  · 데이터: data.go.kr '인천국제공항공사_여객편 정기 운항 스케줄(여행 플랫폼용)'(B551177/statusOfSPaxFlt4TripPlatform) — 출발·도착 각 약 2,100줄.
--    시즌 스케줄이라 거의 안 바뀐다 → 매일 새벽 4시(KST)에 통째로 바꾼다(edge function flight-schedule-sync, 겨울 시즌이 공개되면 자동 반영).
--  · 한국공항공사 운항 스케줄(B551178/flight-schedule)은 조회할 때 편명+날짜로 한 번씩 부르고 24시간 보관한다(edge function flight-lookup).
--  · 두 표 모두 정책 없는 RLS — 읽기·쓰기 모두 service_role(Edge Function)만. 사용자는 flight-lookup(로그인 필요)을 통해서만 본다.
-- ============================================================================

create table if not exists public.icn_flight_schedule (
  id                bigint generated always as identity primary key,
  flight_id         text not null,
  direction         text not null check (direction in ('dep', 'arr')),
  first_date        date not null,
  last_date         date not null,
  -- 인천쪽 시각 HHMM(출발편이면 인천 출발, 도착편이면 인천 도착)
  st                text not null,
  -- 월~일 운항 여부(길이 7)
  days              boolean[] not null check (array_length(days, 1) = 7),
  terminal          text check (terminal in ('t1', 't1c', 't2')),
  airline_ko        text not null default '',
  airline_code      text not null default '',
  master_flight_id  text not null default '',
  other_airport_code text not null default '',
  other_airport_ko   text not null default '',
  synced_at         timestamptz not null default now()
);

create index if not exists icn_flight_schedule_flight_idx on public.icn_flight_schedule (flight_id);

alter table public.icn_flight_schedule enable row level security; -- 정책 없음: service_role만

create table if not exists public.flight_lookup_cache (
  kind       text not null check (kind in ('kac_int', 'kac_dom')),
  cache_key  text not null,
  payload    jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  primary key (kind, cache_key)
);

alter table public.flight_lookup_cache enable row level security; -- 정책 없음: service_role만

-- 전체 교체 — 한 트랜잭션. 빈 목록으로는 바꾸지 않는다(외부 오류로 스케줄이 통째로 사라지는 사고 방지)
create or replace function public.replace_icn_flight_schedule(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_n integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'empty flight schedule';
  end if;
  -- Supabase는 조건 없는 DELETE를 막는다(pg_safeupdate) — where true로 전체 삭제를 분명히 한다
  delete from public.icn_flight_schedule where true;
  insert into public.icn_flight_schedule
    (flight_id, direction, first_date, last_date, st, days, terminal, airline_ko, airline_code, master_flight_id, other_airport_code, other_airport_ko)
  select r->>'flight_id', r->>'direction', (r->>'first_date')::date, (r->>'last_date')::date, r->>'st',
         -- 월~일 순서가 매칭의 핵심이라 배열 원소 순서를 명시한다
         array(select (t.d)::boolean from jsonb_array_elements_text(r->'days') with ordinality as t(d, i) order by t.i),
         nullif(r->>'terminal', ''), coalesce(r->>'airline_ko', ''), coalesce(r->>'airline_code', ''),
         coalesce(r->>'master_flight_id', ''), coalesce(r->>'other_airport_code', ''), coalesce(r->>'other_airport_ko', '')
  from jsonb_array_elements(p_rows) r;
  get diagnostics v_n = row_count;
  -- 한국공항공사 조회 보관분도 같이 비운다(시즌이 바뀌면 옛 시각이 남지 않게)
  delete from public.flight_lookup_cache where fetched_at < now() - interval '2 days';
  return v_n;
end;
$fn$;
revoke all on function public.replace_icn_flight_schedule(jsonb) from public, anon, authenticated;
grant execute on function public.replace_icn_flight_schedule(jsonb) to service_role;

-- 매일 04:00 KST = 19:00 UTC
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'flight-schedule-sync-daily';

select cron.schedule(
  'flight-schedule-sync-daily',
  '0 19 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/flight-schedule-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
