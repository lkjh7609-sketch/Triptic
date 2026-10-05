-- 메일 알림(Resend) — 가입 감사·여행 3일 전 알림·탈퇴 완료 안내. 보내는 곳은 Edge Function send-email.
--  1) email_log: 같은 메일이 두 번 나가지 않게 보낸 기록(회원·종류·대상). 서버(service_role)만 읽고 쓴다.
--  2) email_trip_reminders_due(): 시작일이 3일 뒤(한국 날짜)인 여행의 주인 중 설정 '출발 전 리마인더'를 끄지 않은 회원.
--  3) 매일 00:00 UTC(= 09:00 한국) send-email을 불러 알림을 보낸다 — purge-archive와 같은 방식(vault의 project_url·anon_key·purge_secret).

create table if not exists public.email_log (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'trip_reminder')),
  ref_id text not null default '',
  sent_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);

alter table public.email_log enable row level security;
-- 정책을 하나도 두지 않는다: 일반 회원은 읽지도 쓰지도 못하고, service_role은 RLS를 건너뛴다.
revoke all on public.email_log from anon, authenticated;

create or replace function public.email_trip_reminders_due(p_limit int default 80)
returns table (user_id uuid, trip_id uuid, email text, locale text, display_name text, title text, city text, start_date date)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $fn$
  select t.owner_id, t.id, u.email::text, p.locale, p.display_name, t.title, t.city, t.start_date
  from public.trips t
  join auth.users u on u.id = t.owner_id
  join public.profiles p on p.id = t.owner_id
  where t.deleted_at is null
    and t.start_date = ((now() at time zone 'Asia/Seoul')::date + 3)
    and u.email is not null
    and u.email_confirmed_at is not null
    and coalesce(u.is_anonymous, false) = false
    and coalesce((p.notification_prefs ->> 'preDeparture')::boolean, true)
    and not exists (
      select 1 from public.email_log l
      where l.user_id = t.owner_id and l.kind = 'trip_reminder' and l.ref_id = t.id::text
    )
  order by t.start_date, t.id
  limit least(greatest(p_limit, 1), 200);
$fn$;

revoke all on function public.email_trip_reminders_due(int) from public, anon, authenticated;
grant execute on function public.email_trip_reminders_due(int) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'email-trip-reminders-daily';

select cron.schedule(
  'email-trip-reminders-daily',
  '0 0 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
    ),
    body := '{"kind":"trip_reminders"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
