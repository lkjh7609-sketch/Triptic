-- ============================================================================
-- 0031: fx-refresh를 매시 5분에 호출하는 크론 (pg_cron + pg_net)
--
-- 사전 준비(한 번만, 키를 레포에 두지 않기 위해 Vault에 저장):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<anon key>', 'anon_key');
-- anon 키로 호출해도 안전하다 — fx-refresh는 55분 안에 이미 갱신됐으면 아무것도
-- 하지 않고, 쓰기는 함수 내부의 service_role로만 한다.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'fx-refresh-hourly';

select cron.schedule(
  'fx-refresh-hourly',
  '5 * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/fx-refresh',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
