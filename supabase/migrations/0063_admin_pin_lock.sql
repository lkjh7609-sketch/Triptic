-- ============================================================================
-- 0063: 관리자 6자리 비밀번호(PIN) 로그인의 시도 횟수 잠금.
--
-- 6자리 숫자는 경우의 수가 100만 개라 시도 횟수를 서버가 확실히 막아야 한다. 잠금은:
--   · 전역 — IP를 바꿔도 소용없다(누가 시도하든 합쳐서 5번 틀리면 15분 동안 모두 잠김)
--   · 원자적 — 시도를 "확인 전에" 먼저 세고 행을 잠근 채 처리해서, 동시에 수십 개 요청을 보내도 5번까지만 검사된다
--   · 영속 — DB에 있어서 서버리스 인스턴스가 바뀌어도 유지된다
-- 성공하면 초기화. 마지막 시도 뒤 15분이 지나면 틀린 횟수도 초기화(오래전 실수가 쌓여 잠기지 않게).
--
-- 서비스 역할(서버)만 실행할 수 있다. 앱(anon·authenticated)은 이 테이블과 함수에 접근하지 못한다.
-- ============================================================================

create table if not exists public.admin_pin_state (
  id boolean primary key default true check (id),
  failed_count int not null default 0,
  last_attempt_at timestamptz,
  locked_until timestamptz
);

insert into public.admin_pin_state (id) values (true) on conflict (id) do nothing;

alter table public.admin_pin_state enable row level security;
revoke all on public.admin_pin_state from public, anon, authenticated;

-- 시도 한 번을 "먼저" 센다. allowed=false면 PIN을 확인하지 말고 retry_after초 뒤에 다시 하라고 알린다.
create or replace function public.admin_pin_begin(p_max int default 5, p_lock_seconds int default 900, p_window_seconds int default 900)
returns table (allowed boolean, retry_after int, attempt_no int)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  s public.admin_pin_state%rowtype;
begin
  select * into s from public.admin_pin_state where id for update;

  if s.locked_until is not null and s.locked_until > now() then
    return query select false, ceil(extract(epoch from (s.locked_until - now())))::int, s.failed_count;
    return;
  end if;

  if s.last_attempt_at is null or s.last_attempt_at <= now() - make_interval(secs => p_window_seconds) then
    s.failed_count := 0;
  end if;
  s.failed_count := s.failed_count + 1;

  if s.failed_count >= p_max then
    -- 이번 시도(마지막 기회)는 검사하지만, 그 뒤 요청은 바로 잠금에 걸린다. 이번에 맞으면 admin_pin_reset이 잠금을 푼다
    update public.admin_pin_state
      set failed_count = s.failed_count, last_attempt_at = now(), locked_until = now() + make_interval(secs => p_lock_seconds)
      where id;
  else
    update public.admin_pin_state
      set failed_count = s.failed_count, last_attempt_at = now(), locked_until = null
      where id;
  end if;

  return query select true, 0, s.failed_count;
end;
$fn$;

create or replace function public.admin_pin_reset()
returns void
language sql
security definer
set search_path = public, pg_temp
as $fn$
  update public.admin_pin_state set failed_count = 0, last_attempt_at = null, locked_until = null where id;
$fn$;

-- 시도를 세지 않고 잠금 상태만 본다(화면에 "N분 뒤에 다시" 안내용)
create or replace function public.admin_pin_status()
returns table (locked boolean, retry_after int)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(locked_until > now(), false),
         coalesce(greatest(ceil(extract(epoch from (locked_until - now())))::int, 0), 0)
  from public.admin_pin_state where id;
$fn$;

revoke all on function public.admin_pin_begin(int, int, int) from public, anon, authenticated;
revoke all on function public.admin_pin_reset() from public, anon, authenticated;
revoke all on function public.admin_pin_status() from public, anon, authenticated;
grant execute on function public.admin_pin_begin(int, int, int) to service_role;
grant execute on function public.admin_pin_reset() to service_role;
grant execute on function public.admin_pin_status() to service_role;
