-- ============================================================================
-- 0086: 커뮤니티 글 제목·수정, 댓글 좋아요 — 사용자 결정(2026-10-04)
--  · 글에 제목(title)을 둔다(없는 옛 글은 화면이 본문 첫 줄을 제목으로 보여 준다). 목록에는 제목만, 글을 열어야 본문.
--  · 작성자가 글을 고칠 수 있다(제목·본문·태그·사진). 도시·분류·첨부 일정은 올린 뒤 못 바꾼다(기존 규칙).
--  · 'AI 심사를 없애고 모든 제재는 신고 기반으로'(사용자 결정) — 게시·수정은 심사 없이 바로 게시 상태. 신고가 쌓이면 숨기는
--    기존 신고 트리거는 그대로. 게시·수정 RPC는 service_role 전용이고 Edge Function(moderate-content)이 작성자 id를 넘긴다.
--  · 댓글 좋아요: reactions(target_type='comment')가 이미 허용하므로 댓글에 like_count만 더하고 트리거로 센다.
-- ============================================================================

-- ── 1) 제목 ────────────────────────────────────────────────────────────────
alter table public.posts add column if not exists title text;
alter table public.posts drop constraint if exists posts_title_length;
alter table public.posts add constraint posts_title_length check (title is null or char_length(title) between 1 and 100);

-- 작성자가 직접 바꿀 수 없는 컬럼에 title을 더한다(수정은 update_published_post RPC로만)
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
    if (new.author_id, new.title, new.body, new.status, new.destination_id, new.trip_id, new.language,
        new.category, new.tags, new.view_count, new.pinned_at, new.accepted_comment_id,
        new.like_count, new.comment_count, new.report_count)
       is distinct from
       (old.author_id, old.title, old.body, old.status, old.destination_id, old.trip_id, old.language,
        old.category, old.tags, old.view_count, old.pinned_at, old.accepted_comment_id,
        old.like_count, old.comment_count, old.report_count) then
      raise exception 'only deleted_at and allow_copy can be changed by the author' using errcode = '42501';
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

-- ── 2) 태그 정리(0077 create_moderated_post 안의 규칙과 같다) ──────────────────────
create or replace function public.clean_post_tags(p_tags text[])
returns text[]
language sql
immutable
as $fn$
  select coalesce(array_agg(t order by first_pos), '{}')
  from (
    select t, min(ord) as first_pos
    from (
      select regexp_replace(regexp_replace(btrim(raw), '^#+', ''), '\s+', ' ', 'g') as t, ord
      from unnest(coalesce(p_tags, '{}')) with ordinality as u(raw, ord)
    ) cleaned
    where t <> '' and char_length(t) <= 20
    group by t
    order by min(ord)
    limit 3
  ) deduped;
$fn$;

-- ── 3) 게시(제목 포함, 심사 없음) ─────────────────────────────────────────────
create or replace function public.create_published_post(
  p_author_id uuid,
  p_destination_id uuid,
  p_trip_id uuid,
  p_title text,
  p_body text,
  p_language text,
  p_images jsonb,
  p_category text,
  p_tags text[]
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post_id uuid;
begin
  v_post_id := public.create_moderated_post(
    p_author_id, p_destination_id, p_trip_id, p_body, p_language, p_images, 'published', 0, '{}'::jsonb, p_category, p_tags
  );
  update public.posts set title = nullif(btrim(p_title), '') where id = v_post_id;
  return v_post_id;
end;
$fn$;
revoke all on function public.create_published_post(uuid, uuid, uuid, text, text, text, jsonb, text, text[]) from public, anon, authenticated;
grant execute on function public.create_published_post(uuid, uuid, uuid, text, text, text, jsonb, text, text[]) to service_role;

-- ── 4) 수정(작성자 본인의 제목·본문·태그·사진) ────────────────────────────────────
create or replace function public.update_published_post(
  p_post_id uuid,
  p_author_id uuid,
  p_title text,
  p_body text,
  p_language text,
  p_tags text[],
  p_images jsonb
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_image jsonb;
  v_found uuid;
begin
  select id into v_found from public.posts
  where id = p_post_id and author_id = p_author_id and deleted_at is null and status in ('published', 'pending_review', 'hidden');
  if v_found is null then
    raise exception 'post not found or not yours' using errcode = '42501';
  end if;

  update public.posts
  set title = nullif(btrim(p_title), ''),
      body = p_body,
      language = p_language,
      tags = public.clean_post_tags(p_tags),
      updated_at = now()
  where id = p_post_id;

  if p_images is not null then
    delete from public.post_images where post_id = p_post_id;
    for v_image in select * from jsonb_array_elements(p_images) loop
      insert into public.post_images (post_id, storage_path, width, height, position, status)
      values (
        p_post_id,
        v_image->>'storagePath',
        (v_image->>'width')::int,
        (v_image->>'height')::int,
        coalesce((v_image->>'position')::int, 0),
        'published'
      );
    end loop;
  end if;
end;
$fn$;
revoke all on function public.update_published_post(uuid, uuid, text, text, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.update_published_post(uuid, uuid, text, text, text, text[], jsonb) to service_role;

-- ── 5) 댓글 좋아요 ────────────────────────────────────────────────────────────
alter table public.comments add column if not exists like_count integer not null default 0;

create or replace function public.bump_post_like_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'INSERT' and new.target_type = 'post' then
    update public.posts set like_count = like_count + 1 where id = new.target_id;
  elsif tg_op = 'DELETE' and old.target_type = 'post' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.target_id;
  elsif tg_op = 'INSERT' and new.target_type = 'comment' then
    update public.comments set like_count = like_count + 1 where id = new.target_id;
  elsif tg_op = 'DELETE' and old.target_type = 'comment' then
    update public.comments set like_count = greatest(like_count - 1, 0) where id = old.target_id;
  end if;
  return coalesce(new, old);
end;
$fn$;
revoke all on function public.bump_post_like_count() from public;
