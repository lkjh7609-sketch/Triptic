/**
 * Supabase Edge Function: purge-archive — 보관함에서 삭제된 글의 사진 파일을 1달 뒤에 지운다 (0068)
 *
 * 호출: pg_cron이 매일 새벽(0068). 비밀값(x-purge-secret = PURGE_SECRET)이 맞아야만 동작한다 — 삭제를 부르는 함수라 아무나 못 부르게.
 * 하는 일: archive_files_due()가 알려 주는 글(삭제 후 1달 지난 것)의 post-images 파일을 지우고,
 *   지운 글만 archive_mark_files_purged()로 보관함 안의 사진 목록을 비운다. 실패한 글은 비우지 않아 다음 날 다시 시도한다.
 * 행 자체(2달)는 DB의 purge_expired_archive()가 지운다 — 사진 목록이 비어야 지워지므로 파일이 먼저 지워진 것이 보장된다.
 */
import { createClient } from '@supabase/supabase-js';
import { ownPaths, secretMatches } from './paths.ts';

const BUCKET = 'post-images';
const CHUNK = 100;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!secretMatches(req.headers.get('x-purge-secret'), Deno.env.get('PURGE_SECRET'))) return json(401, { error: 'unauthorized' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: due, error } = await admin.rpc('archive_files_due', { p_limit: 200 });
  if (error) return json(500, { error: 'due_failed' });

  let posts = 0;
  let files = 0;
  let failed = 0;
  for (const row of (due ?? []) as { id: number; author_id: string; paths: string[] }[]) {
    const paths = ownPaths(row.author_id, row.paths ?? []);
    let ok = true;
    for (let i = 0; i < paths.length; i += CHUNK) {
      const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + CHUNK));
      if (rmErr) { ok = false; break; }
    }
    if (!ok) { failed++; continue; }
    const { error: markErr } = await admin.rpc('archive_mark_files_purged', { p_id: row.id });
    if (markErr) { failed++; continue; }
    posts++;
    files += paths.length;
  }
  return json(200, { posts, files, failed });
});
