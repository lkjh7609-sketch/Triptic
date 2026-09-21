-- ============================================================================
-- 0023: 모더레이션 통과 후 게시 처리 RPC + INSERT 정책 강화
-- 출처: docs/specs/06-community.md §5.1 흐름도
--
-- 발견한 문제: 0020의 "insert own posts"/"insert own comments" 정책은
-- author_id만 확인하고 status는 클라이언트가 마음대로 지정할 수 있었다 —
-- 즉 클라이언트가 moderate-content Edge Function을 건너뛰고 직접
-- status='published'로 글을 올려 모더레이션을 완전히 우회할 수 있는 구멍이
-- 있었다. §5.1의 흐름도("게시 전에 자동 검사")가 실제로 강제되려면 게시
-- 상태 결정은 서버(Edge Function)만 할 수 있어야 한다.
--
-- 해결: 실제 insert는 이 파일의 security definer RPC로만 하고, 직접 테이블
-- insert 정책은 안전한 값으로 조인다(우회해도 최악의 경우가 "운영자 검토
-- 대기"이지 "즉시 게시"가 아니게).
-- ============================================================================

drop policy if exists "insert own posts" on public.posts;
create policy "insert own posts"
  on public.posts for insert
  with check (author_id = auth.uid() and status = 'pending_review');

drop policy if exists "insert own comments" on public.comments;
create policy "insert own comments"
  on public.comments for insert
  with check (false);

create or replace function public.create_moderated_post(
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
  if p_status not in ('published', 'pending_review', 'removed') then
    raise exception 'invalid status %', p_status;
  end if;

  insert into public.posts (destination_id, author_id, body, language, trip_id, status)
  values (p_destination_id, auth.uid(), p_body, p_language, p_trip_id, p_status)
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
revoke all on function public.create_moderated_post(uuid, uuid, text, text, jsonb, text, numeric, jsonb) from public;
grant execute on function public.create_moderated_post(uuid, uuid, text, text, jsonb, text, numeric, jsonb) to authenticated;

create or replace function public.create_moderated_comment(
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
  if p_status not in ('published', 'removed') then
    raise exception 'invalid comment status %', p_status;
  end if;

  insert into public.comments (post_id, author_id, parent_id, body, status)
  values (p_post_id, auth.uid(), p_parent_id, p_body, p_status)
  returning id into v_comment_id;

  if p_status <> 'published' then
    insert into public.moderation_events (target_type, target_id, action, source, score, categories)
    values ('comment', v_comment_id, 'auto_blocked', 'classifier', p_score, p_categories);
  end if;

  return v_comment_id;
end;
$fn$;
revoke all on function public.create_moderated_comment(uuid, uuid, text, text, numeric, jsonb) from public;
grant execute on function public.create_moderated_comment(uuid, uuid, text, text, numeric, jsonb) to authenticated;
