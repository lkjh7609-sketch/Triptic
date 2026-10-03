-- ============================================================================
-- 0082: 외교부 여행경보 — travel_alerts(국가·지역별 현재 경보) + 매일 오전 9시(KST) 갱신 크론.
--  · 데이터: data.go.kr '외교부_국가∙지역별 여행경보'(TravelAlarmService2). 한 나라가 지역별로 여러 줄(단계 1~4).
--  · is_base = 그 나라의 '나머지 지역'(또는 전 지역) 줄 — 도시에는 이 단계를 적용한다(없으면 기본 단계 없음).
--  · 누구나 읽을 수 있고(경보 안내·여행 만들기 팝업), 쓰기는 Edge Function(travel-alerts-refresh, service_role)이
--    replace_travel_alerts로 통째로 바꾼다(해제된 경보는 다음 갱신 때 자연스럽게 사라진다).
--  · 크론은 0031과 같이 Vault의 project_url·anon_key를 쓴다. 함수는 6시간 안에 이미 갱신됐으면 아무것도 하지 않는다.
-- ============================================================================

create table if not exists public.travel_alerts (
  id              bigint generated always as identity primary key,
  country_code    text not null check (country_code ~ '^[A-Z]{2}$'),
  country_name_ko text not null,
  country_name_en text not null default '',
  alarm_lvl       smallint not null check (alarm_lvl between 1 and 4),
  region_scope    text not null check (region_scope in ('all', 'part')),
  remark          text not null default '',
  is_base         boolean not null default false,
  fetched_at      timestamptz not null default now()
);

create index if not exists travel_alerts_country_idx on public.travel_alerts (country_code);

alter table public.travel_alerts enable row level security;
drop policy if exists "public read travel alerts" on public.travel_alerts;
create policy "public read travel alerts" on public.travel_alerts for select using (true);
grant select on public.travel_alerts to anon, authenticated;

-- 전체 교체 — 한 트랜잭션이라 읽는 쪽은 옛 목록 또는 새 목록만 본다. 빈 목록으로는 교체하지 않는다(외부 오류로 경보가 전부 사라지는 사고 방지)
create or replace function public.replace_travel_alerts(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_n integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'empty travel alerts';
  end if;
  delete from public.travel_alerts;
  insert into public.travel_alerts (country_code, country_name_ko, country_name_en, alarm_lvl, region_scope, remark, is_base)
  select r->>'country_code', r->>'country_name_ko', coalesce(r->>'country_name_en', ''),
         (r->>'alarm_lvl')::smallint, r->>'region_scope', coalesce(r->>'remark', ''), coalesce((r->>'is_base')::boolean, false)
  from jsonb_array_elements(p_rows) r;
  get diagnostics v_n = row_count;
  return v_n;
end;
$fn$;
revoke all on function public.replace_travel_alerts(jsonb) from public, anon, authenticated;
grant execute on function public.replace_travel_alerts(jsonb) to service_role;

-- 매일 오전 9시(KST) = 00:00 UTC
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'travel-alerts-daily';

select cron.schedule(
  'travel-alerts-daily',
  '0 0 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/travel-alerts-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
