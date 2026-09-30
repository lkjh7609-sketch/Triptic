-- ============================================================================
-- 0065: 회원 탈퇴 즉시 삭제 — 사용자 데이터 삭제 함수.
--
-- 예전 탈퇴(0011)는 deletion_requested_at 시각만 기록하고, 30일 뒤 삭제하는 처리는 만들지 않아 계정이 영영 남았다.
-- 이제 탈퇴는 서버(api/deleteAccount.js)가 즉시 삭제한다: 예약 서류·게시 이미지 파일 삭제 → 이 함수 → 로그인 계정 삭제.
--
-- purge_user_data(사용자) — 서비스 역할(서버)만 실행. profiles 행을 지우면 여행·서류·게시글·댓글·동행 기록·건의 등
-- 대부분이 CASCADE로 함께 사라진다. 삭제를 막는 연결(NO ACTION) 4곳은 먼저 비운다(남의 여행에 남긴 항목의 작성자 표시 등):
--   expenses.paid_by · itinerary_items.created_by · reports.resolver_id · moderation_events.actor_id
-- 관리자 계정은 이 함수로 지우지 않는다(실수로 운영자가 사라지는 것을 막는다). 없는 사용자에게는 아무 일도 안 한다(다시 불러도 안전).
-- ============================================================================

create or replace function public.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'admin accounts cannot be purged' using errcode = '42501';
  end if;

  update public.expenses set paid_by = null where paid_by = p_user_id;
  update public.itinerary_items set created_by = null where created_by = p_user_id;
  update public.reports set resolver_id = null where resolver_id = p_user_id;
  update public.moderation_events set actor_id = null where actor_id = p_user_id;

  delete from public.profiles where id = p_user_id;
end;
$fn$;

revoke all on function public.purge_user_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;
