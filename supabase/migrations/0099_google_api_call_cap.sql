-- ============================================================================
-- 0099: 구글 API 월 호출 상한(서버 전체 합계) — api/_lib/googleCap.js
--
-- 서버가 구글을 부르기 직전에 take_google_call(종류, 한도)로 1회분을 쓴다. 이번 달(UTC) 호출 수가 한도에 닿으면
-- allowed=false라 호출하지 않는다. 확인과 기록이 한 문장(upsert)이라 동시에 여러 요청이 와도 한도를 넘지 못한다.
-- 서버(service_role)만 읽고 쓴다. 이번 달 사용량: select * from google_api_calls order by month desc, kind;
-- ============================================================================

create table if not exists public.google_api_calls (
  kind  text not null,
  month text not null,
  calls int  not null default 0,
  primary key (kind, month)
);

alter table public.google_api_calls enable row level security;
revoke all on table public.google_api_calls from anon, authenticated;

create or replace function public.take_google_call(p_kind text, p_limit int, p_count int default 1)
returns table (allowed boolean, used int)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_month text := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_used int;
begin
  if p_count < 1 or p_count > p_limit then
    select coalesce(calls, 0) into v_used from public.google_api_calls where kind = p_kind and month = v_month;
    return query select false, coalesce(v_used, 0);
    return;
  end if;

  insert into public.google_api_calls as g (kind, month, calls)
  values (p_kind, v_month, p_count)
  on conflict (kind, month) do update set calls = g.calls + p_count
    where g.calls + p_count <= p_limit
  returning g.calls into v_used;

  if v_used is null then
    select calls into v_used from public.google_api_calls where kind = p_kind and month = v_month;
    return query select false, coalesce(v_used, 0);
  else
    return query select true, v_used;
  end if;
end;
$fn$;

revoke all on function public.take_google_call(text, int, int) from public, anon, authenticated;
grant execute on function public.take_google_call(text, int, int) to service_role;
