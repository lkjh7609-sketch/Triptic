-- ============================================================================
-- 0011: 계정 삭제 요청 (즉시 반영분) — 02-screens.md §5.1
-- App Store Guideline 5.1.1(v) 대응. 이 마이그레이션은 "즉시 실행되는 부분"만
-- 다룬다: 본인의 deletion_requested_at을 지금 시각으로 기록한다.
--
-- 아직 구현하지 않은 것 (후속 작업, 이번 라운드 범위 밖):
--   - 30일 후 auth.users 포함 완전 삭제를 수행하는 Edge Function 스케줄러(pg_cron)
--   - "모든 데이터 비공개 전환"(다른 사용자에게 내 글 등이 안 보이게 하는 로직) —
--     커뮤니티 스키마(06-community.md)가 아직 없으므로 Phase 5에서 함께 구현한다
--   - 재로그인 시 복구 안내 UI 트리거(서버는 deletion_requested_at이 not null임을
--     알려주기만 하면 되므로 이 함수로 충분하다)
-- ============================================================================

create or replace function public.request_account_deletion()
returns void
language sql
security invoker
set search_path = public, pg_temp
as $fn$
  update public.profiles set deletion_requested_at = now() where id = auth.uid();
$fn$;

grant execute on function public.request_account_deletion() to authenticated;

-- 재로그인 시 유예 상태인지 확인하는 용도
create or replace function public.get_own_deletion_status()
returns table (deletion_requested_at timestamptz)
language sql
security invoker
set search_path = public, pg_temp
as $fn$
  select deletion_requested_at from public.profiles where id = auth.uid();
$fn$;

grant execute on function public.get_own_deletion_status() to authenticated;

-- 유예 중 재로그인 시 삭제 취소(복구)
create or replace function public.cancel_account_deletion()
returns void
language sql
security invoker
set search_path = public, pg_temp
as $fn$
  update public.profiles set deletion_requested_at = null where id = auth.uid();
$fn$;

grant execute on function public.cancel_account_deletion() to authenticated;
