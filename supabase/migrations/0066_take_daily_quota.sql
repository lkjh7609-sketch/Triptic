-- ============================================================================
-- 0066: 로그인 사용자별 하루(최근 24시간) 사용 한도 — 원자적으로 확인하고 기록한다.
--
-- take_daily_quota(사용자, 종류, 한도) — 지금까지 쓴 양이 한도 미만이면 usage_events에 1건 기록하고 allowed=true,
-- 이미 한도면 기록하지 않고 allowed=false. 사용자·종류별 advisory 락으로 "확인 후 기록" 사이에 다른 요청이 끼어들지 못하게 해서,
-- 동시에 수십 개를 보내도 한도를 넘지 못한다.
-- AI(LLM) 호출 API(/api/recommend·/api/cityDesc)가 kind='ai.generate'로 쓴다(무료 10회·프로 100회는 서버 코드가 정한다).
-- 서비스 역할(서버)만 실행한다.
-- ============================================================================

create or replace function public.take_daily_quota(
  p_user_id uuid,
  p_kind text,
  p_limit int,
  p_meta jsonb default '{}'::jsonb,
  p_window interval default interval '24 hours'
)
returns table (allowed boolean, used int)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_used numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || '|' || p_kind, 0));

  select coalesce(sum(quantity), 0) into v_used
  from public.usage_events
  where user_id = p_user_id and kind = p_kind and created_at > now() - p_window;

  if v_used >= p_limit then
    return query select false, v_used::int;
  else
    insert into public.usage_events (user_id, kind, quantity, meta) values (p_user_id, p_kind, 1, coalesce(p_meta, '{}'::jsonb));
    return query select true, (v_used + 1)::int;
  end if;
end;
$fn$;

revoke all on function public.take_daily_quota(uuid, text, int, jsonb, interval) from public, anon, authenticated;
grant execute on function public.take_daily_quota(uuid, text, int, jsonb, interval) to service_role;
