-- ============================================================================
-- 0048: 동행 멤버 목록을 멤버 누구나 볼 수 있게 하는 RPC
--
-- listCompanionMatchMembers()가 companion_applications(status='accepted')를
-- 직접 읽는데, 그 테이블 select 정책은 "본인 신청" + "내가 주최한 글의
-- 신청"뿐이라 주최자가 아닌 멤버는 다른 수락 멤버를 못 봤다 — 3명 이상
-- 모임에서 채팅 멤버 수/매칭 멤버 목록이 틀리고, 0047 후기는 "나머지 멤버
-- 전원"을 평가해야 해서 제출 자체가 불가능했다. 신청 메시지까지 노출하는
-- 정책 대신 멤버 user_id만 돌려주는 SECURITY DEFINER 함수로 연다.
-- ============================================================================

create or replace function public.list_companion_member_ids(p_post_id uuid)
returns setof uuid language sql stable security definer set search_path = public, pg_temp
as $fn$
  select p.author_id from public.companion_posts p
    where p.id = p_post_id and public.is_companion_member(p_post_id)
  union
  select a.applicant_id from public.companion_applications a
    where a.post_id = p_post_id and a.status = 'accepted' and public.is_companion_member(p_post_id);
$fn$;
revoke all on function public.list_companion_member_ids(uuid) from public, anon, authenticated;
grant execute on function public.list_companion_member_ids(uuid) to authenticated;
