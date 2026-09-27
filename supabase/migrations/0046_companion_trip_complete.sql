-- ============================================================================
-- 0046: 동행 일정 완료(주최자) + 종료일이 지나면 자동 완료
--
-- 매칭(matched) 이후 끝나는 상태가 없어서, 여행이 끝나도 채팅방/QR이 계속
-- "진행 중"으로 남았다. status 'closed'(0032 check에 이미 있음)를 일정 완료로
-- 쓴다. closed가 되면
--   - 채팅은 읽기 전용(보내기 정책이 matched만 허용, 0033)
--   - QR 토큰 무효화(모임 취소와 같음)
--   - 후기/별점(0047)을 남길 수 있다
--
-- 자동 완료 기준 시각은 Asia/Seoul — 10/1~10/2 일정이면 KST 10/3 00:00이
-- 지나면 닫힌다(end_date < 오늘, <= 아님). 15분마다 돈다.
-- ============================================================================

create or replace function public.complete_companion_trip(p_post_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post record;
begin
  select * into v_post from public.companion_posts where id = p_post_id for update;
  if v_post is null then raise exception 'companion post not found'; end if;
  if v_post.author_id <> (select auth.uid()) then raise exception 'only the organizer can complete this trip' using errcode = '42501'; end if;
  if v_post.status <> 'matched' then raise exception 'trip is not in progress'; end if;
  -- 시작 전 종료는 "완료"가 아니라 모임 취소다
  if v_post.start_date > (now() at time zone 'Asia/Seoul')::date then
    raise exception 'trip has not started yet';
  end if;

  update public.companion_posts set status = 'closed', updated_at = now() where id = p_post_id;
  update public.companion_qr_tokens set revoked_at = now() where post_id = p_post_id and revoked_at is null;
end;
$fn$;
revoke all on function public.complete_companion_trip(uuid) from public, anon, authenticated;
grant execute on function public.complete_companion_trip(uuid) to authenticated;

create or replace function public.close_ended_companion_trips()
returns int language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_count int;
begin
  with closed as (
    update public.companion_posts
      set status = 'closed', updated_at = now()
      where status = 'matched'
        and deleted_at is null
        and end_date < (now() at time zone 'Asia/Seoul')::date
      returning id
  ), revoked as (
    update public.companion_qr_tokens t
      set revoked_at = now()
      from closed c
      where t.post_id = c.id and t.revoked_at is null
      returning t.id
  )
  select count(*) into v_count from closed;
  return v_count;
end;
$fn$;
revoke all on function public.close_ended_companion_trips() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'close-ended-companion-trips';

select cron.schedule(
  'close-ended-companion-trips',
  '*/15 * * * *',
  $cron$ select public.close_ended_companion_trips(); $cron$
);
