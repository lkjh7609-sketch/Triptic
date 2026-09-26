-- ============================================================================
-- 0029: 커뮤니티 모더레이션 우회 경로 차단
--
-- 발견한 구멍 (2026-09-26 리뷰):
-- 1) create_moderated_post/comment RPC가 authenticated에 열려 있어서, 로그인
--    사용자가 /rest/v1/rpc/create_moderated_post 에 p_status='published'를 직접
--    넣어 호출하면 moderate-content(AI 검열)를 통째로 건너뛸 수 있었다.
-- 2) "update own posts" 정책이 USING(author_id=auth.uid()) WITH CHECK(status='published')
--    라서, pending_review로 직접 insert한 글이나 운영자가 숨긴(hidden/removed) 글을
--    작성자가 status='published'로 되돌릴 수 있었다.
-- 3) 댓글 작성자용 UPDATE 정책이 없어서 deleteOwnComment(soft delete)가 조용히
--    0행 갱신으로 끝나고 있었다(삭제 안 됨).
--
-- 해결:
-- - RPC는 author_id를 인자로 받고 service_role만 실행한다. moderate-content가
--   사용자 JWT를 검증한 뒤 service_role 클라이언트로 호출한다.
-- - 작성자는 본인 글/댓글의 deleted_at만 바꿀 수 있다(트리거로 강제). 카운터
--   갱신·신고 누적 숨김 같은 security definer 트리거 경로와 운영자는 영향 없음.
-- ============================================================================

-- ── 1) RPC: author를 인자로, service_role 전용 ─────────────────────────────
drop function if exists public.create_moderated_post(uuid, uuid, text, text, jsonb, text, numeric, jsonb);
drop function if exists public.create_moderated_comment(uuid, uuid, text, text, numeric, jsonb);

create or replace function public.create_moderated_post(
  p_author_id uuid,
  p_destination_id uuid,
  p_trip_id uuid,
  p_body text,
  p_language text,
  p_images jsonb,
  p_status text,
  p_score numeric,
  p_categories jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post_id uuid;
  v_image jsonb;
begin
  if p_author_id is null then
    raise exception 'author required';
  end if;
  if p_status not in ('published', 'pending_review', 'removed') then
    raise exception 'invalid status %', p_status;
  end if;

  insert into public.posts (destination_id, author_id, body, language, trip_id, status)
  values (p_destination_id, p_author_id, p_body, p_language, p_trip_id, p_status)
  returning id into v_post_id;

  for v_image in select * from jsonb_array_elements(coalesce(p_images, '[]'::jsonb)) loop
    insert into public.post_images (post_id, storage_path, width, height, position, status)
    values (
      v_post_id,
      v_image->>'storagePath',
      (v_image->>'width')::int,
      (v_image->>'height')::int,
      coalesce((v_image->>'position')::int, 0),
      p_status
    );
  end loop;

  if p_status <> 'published' then
    insert into public.moderation_events (target_type, target_id, action, source, score, categories)
    values (
      'post', v_post_id,
      case when p_status = 'removed' then 'auto_blocked' else 'auto_flagged' end,
      'classifier', p_score, p_categories
    );
  end if;

  return v_post_id;
end;
$fn$;
revoke all on function public.create_moderated_post(uuid, uuid, uuid, text, text, jsonb, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.create_moderated_post(uuid, uuid, uuid, text, text, jsonb, text, numeric, jsonb) to service_role;

create or replace function public.create_moderated_comment(
  p_author_id uuid,
  p_post_id uuid,
  p_parent_id uuid,
  p_body text,
  p_status text,
  p_score numeric,
  p_categories jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_comment_id uuid;
begin
  if p_author_id is null then
    raise exception 'author required';
  end if;
  if p_status not in ('published', 'removed') then
    raise exception 'invalid comment status %', p_status;
  end if;

  insert into public.comments (post_id, author_id, parent_id, body, status)
  values (p_post_id, p_author_id, p_parent_id, p_body, p_status)
  returning id into v_comment_id;

  if p_status <> 'published' then
    insert into public.moderation_events (target_type, target_id, action, source, score, categories)
    values ('comment', v_comment_id, 'auto_blocked', 'classifier', p_score, p_categories);
  end if;

  return v_comment_id;
end;
$fn$;
revoke all on function public.create_moderated_comment(uuid, uuid, uuid, text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.create_moderated_comment(uuid, uuid, uuid, text, text, numeric, jsonb) to service_role;

-- ── 2) 작성자는 soft delete(deleted_at)만 ─────────────────────────────────
-- current_user = 'authenticated'인 경우(= PostgREST로 들어온 사용자 직접 UPDATE)에만
-- 검사한다. security definer 트리거(좋아요/댓글 수 갱신, 신고 누적 숨김)는
-- 함수 소유자 권한으로 실행되므로 current_user가 달라 영향받지 않는다.
create or replace function public.guard_author_content_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    return new;
  end if;

  if tg_table_name = 'posts' then
    if (new.author_id, new.body, new.status, new.destination_id, new.trip_id, new.language)
       is distinct from
       (old.author_id, old.body, old.status, old.destination_id, old.trip_id, old.language) then
      raise exception 'only deleted_at can be changed by the author' using errcode = '42501';
    end if;
  elsif tg_table_name = 'comments' then
    if (new.author_id, new.body, new.status, new.post_id, new.parent_id)
       is distinct from
       (old.author_id, old.body, old.status, old.post_id, old.parent_id) then
      raise exception 'only deleted_at can be changed by the author' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function public.guard_author_content_update() from public, anon, authenticated;

drop trigger if exists posts_guard_author_update on public.posts;
create trigger posts_guard_author_update
  before update on public.posts
  for each row execute function public.guard_author_content_update();

drop trigger if exists comments_guard_author_update on public.comments;
create trigger comments_guard_author_update
  before update on public.comments
  for each row execute function public.guard_author_content_update();

drop policy if exists "update own posts" on public.posts;
create policy "update own posts"
  on public.posts for update
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

drop policy if exists "update own comments" on public.comments;
create policy "update own comments"
  on public.comments for update
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
