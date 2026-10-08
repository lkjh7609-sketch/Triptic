-- ============================================================================
-- 0103: iOS 푸시 알림 발송 연결(Edge Function send-push, APNs). 먼저 함수를 배포하고 APNs 비밀값을 넣은 뒤에 적용한다.
--  1) push_log: 같은 푸시가 두 번 나가지 않게 보낸 기록(회원·종류·대상). 서버(service_role)만 읽고 쓴다.
--  2) push_trip_reminders_due(): 시작일이 3일 뒤(한국 날짜)인 여행의 주인 중 '출발 전 리마인더'를 끄지 않았고 iOS 기기가 등록된 회원.
--  3) 커뮤니티 알림(내 글에 댓글·내 댓글에 답글)이 만들어지면 send-push를 부르는 트리거 — 실패해도 알림 저장은 막지 않는다.
--  4) 매일 00:05 UTC(= 09:05 한국) send-push로 출발 3일 전 알림 — 0093(메일)과 같은 방식(vault의 project_url·anon_key·purge_secret).
-- ============================================================================

create table if not exists public.push_log (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('trip_reminder')),
  ref_id text not null default '',
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

create or replace function public.push_trip_reminders_due(p_limit int default 200)
returns table (user_id uuid, trip_id uuid, locale text, title text, start_date date)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $fn$
  select t.owner_id, t.id, p.locale, t.title, t.start_date
  from public.trips t
  join public.profiles p on p.id = t.owner_id
  where t.deleted_at is null
    and t.start_date = ((now() at time zone 'Asia/Seoul')::date + 3)
    and coalesce((p.notification_prefs ->> 'preDeparture')::boolean, true)
    and exists (select 1 from public.push_tokens k where k.user_id = t.owner_id and k.platform = 'ios')
    and not exists (
      select 1 from public.push_log l
      where l.user_id = t.owner_id and l.kind = 'trip_reminder' and l.ref_id = t.id::text
    )
  order by t.start_date, t.id
  limit least(greatest(p_limit, 1), 500);
$fn$;

revoke all on function public.push_trip_reminders_due(int) from public, anon, authenticated;
grant execute on function public.push_trip_reminders_due(int) to service_role;

create or replace function public.push_after_community_notice()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
begin
  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
      ),
      body := jsonb_build_object('kind', 'notification', 'notification_id', new.id),
      timeout_milliseconds := 5000
    );
  exception when others then
    null; -- 푸시를 못 불러도 알림 저장은 그대로
  end;
  return new;
end;
$fn$;

revoke all on function public.push_after_community_notice() from public, anon, authenticated;

drop trigger if exists push_after_community_notice on public.notifications;
create trigger push_after_community_notice
  after insert on public.notifications
  for each row
  when (new.kind in ('post_comment', 'comment_reply'))
  execute function public.push_after_community_notice();

select cron.unschedule(jobid) from cron.job where jobname = 'push-trip-reminders-daily';

select cron.schedule(
  'push-trip-reminders-daily',
  '5 0 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
    ),
    body := '{"kind":"trip_reminders"}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
