-- ============================================================================
-- 0068: 보관함 보관 기간 — 삭제·취소 후 2달이 지나면 보관함 행 삭제, 게시 사진 파일은 1달이 지나면 삭제.
--
-- 기준 시각은 "삭제·취소한 때"다(보관함에 옮긴 때가 아님): 글은 snapshot.deleted_at, 동행 모집은 snapshot.updated_at(취소한 때).
-- 그런 값이 없으면 archived_at을 쓴다.
--
-- 사진(1달): 저장소 파일은 SQL로 지울 수 없어서(버킷이 공개이고 파일은 저장소 API로만 지워진다) Edge Function purge-archive가 지운다.
--   함수는 archive_files_due()로 기한이 지난 글의 사진 경로를 받아 파일을 지우고, archive_mark_files_purged()로 보관함 안의
--   사진 목록을 비운다(지운 뒤에만 비우므로, 파일 삭제가 실패하면 다음 날 다시 시도한다).
-- 행(2달): purge_expired_archive()가 기한이 지난 행을 지운다. 사진 목록이 아직 남아 있으면(=파일이 안 지워졌으면) 지우지 않는다 — 파일이 주인 없이 남지 않게.
--
-- 사전 준비(한 번만, 삭제를 부르는 크론이라 아무나 못 부르게 비밀값으로 잠근다. 키는 레포에 두지 않는다):
--   1) 임의의 긴 문자열을 하나 정한다.
--   2) supabase secrets set PURGE_SECRET=<그 값>
--   3) select vault.create_secret('<그 값>', 'purge_secret');      -- (project_url, anon_key는 0031에서 이미 저장)
--   4) supabase functions deploy purge-archive
-- 이용자에게는 보이지 않는 함수라 전부 서비스 역할만 실행한다.
-- ============================================================================

alter table public.archived_content add column if not exists images_purged_at timestamptz;

-- 기한이 지난 글의 사진 경로 목록 (아직 살아 있는 글이 같은 경로를 쓰고 있으면 뺀다 — 지금은 경로가 업로드마다 새 uuid라 없지만 안전장치)
create or replace function public.archive_files_due(p_limit int default 200)
returns table (id bigint, author_id uuid, paths text[])
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select a.id, a.author_id,
         array(
           select i->>'storage_path'
           from jsonb_array_elements(a.children->'post_images') i
           where i->>'storage_path' is not null
             and not exists (select 1 from public.post_images pi where pi.storage_path = i->>'storage_path')
         )
  from public.archived_content a
  where a.source_table = 'posts'
    and jsonb_array_length(coalesce(a.children->'post_images', '[]'::jsonb)) > 0
    and coalesce((a.snapshot->>'deleted_at')::timestamptz, a.archived_at) < now() - interval '1 month'
  order by a.archived_at
  limit least(greatest(p_limit, 1), 500);
$fn$;

-- 파일을 지운 뒤 보관함 안의 사진 목록을 비운다
create or replace function public.archive_mark_files_purged(p_id bigint)
returns void
language sql
security definer
set search_path = public, pg_temp
as $fn$
  update public.archived_content
     set children = jsonb_set(children, '{post_images}', '[]'::jsonb),
         images_purged_at = now()
   where id = p_id and source_table = 'posts';
$fn$;

-- 삭제·취소 후 2달이 지난 행을 지운다(사진 파일이 아직 남은 글은 제외). 지운 행 수를 돌려준다.
create or replace function public.purge_expired_archive()
returns int
language sql
security definer
set search_path = public, pg_temp
as $fn$
  with gone as (
    delete from public.archived_content a
    where coalesce(
            case a.source_table
              when 'posts' then (a.snapshot->>'deleted_at')::timestamptz
              else (a.snapshot->>'updated_at')::timestamptz
            end,
            a.archived_at
          ) < now() - interval '2 months'
      and jsonb_array_length(coalesce(a.children->'post_images', '[]'::jsonb)) = 0
    returning 1
  )
  select count(*)::int from gone;
$fn$;

revoke all on function public.archive_files_due(int) from public, anon, authenticated;
revoke all on function public.archive_mark_files_purged(bigint) from public, anon, authenticated;
revoke all on function public.purge_expired_archive() from public, anon, authenticated;
grant execute on function public.archive_files_due(int) to service_role;
grant execute on function public.archive_mark_files_purged(bigint) to service_role;
grant execute on function public.purge_expired_archive() to service_role;

-- ── 매일 새벽(한국 시간 03:00 사진, 03:30 행) ────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname in ('archive-purge-files-daily', 'archive-purge-rows-daily');

select cron.schedule(
  'archive-purge-files-daily',
  '0 18 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge-archive',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

select cron.schedule(
  'archive-purge-rows-daily',
  '30 18 * * *',
  $cron$ select public.purge_expired_archive(); $cron$
);
