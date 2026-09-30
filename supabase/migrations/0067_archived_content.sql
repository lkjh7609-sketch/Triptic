-- ============================================================================
-- 0067: 삭제한 글·동행 모집을 보관함 테이블로 — 실제 테이블에는 살아 있는 것만 남긴다.
--
-- 예전에는 삭제가 행에 deleted_at(또는 status)만 찍는 "숨김"이라, 지운 글이 실제 테이블에 계속 섞여 있었다
-- (개수를 셀 때 삭제된 것까지 세는 실수도 났다). 이제 삭제하는 순간 DB가 그 글을 archived_content(보관함)로 옮기고
-- 실제 테이블에서는 지운다. 앱 코드는 그대로다(앱은 예전처럼 deleted_at만 찍는다).
--
-- 무엇을 옮기나
--   · posts: 사용자가 삭제(deleted_at)한 글 — 댓글과 이미지 정보도 함께 보관함에 담고 실제 테이블에서는 지운다.
--   · companion_posts: 작성자가 취소한 모집 중 "지원·채팅·정산이 전혀 없고 성사된 적 없는 것"만. 지원자나 그룹 기록이 있으면
--     실제 테이블에 그대로 둔다(지우면 지원 내역·채팅·정산이 함께 사라지므로).
--   · 운영자가 숨긴(status='removed') 글·모집은 신고 처리 기록이라 옮기지 않는다.
-- 보관함에는 원본 행 전체(snapshot)와 딸린 것(children)을 JSON으로 담는다. 이용자에게는 공개되지 않고(RLS, 정책 없음),
-- 운영자만 관리자 함수로 읽는다.
--
-- 탈퇴: 보관함의 글은 작성자 탈퇴 시 함께 삭제된다(author_id CASCADE). 다른 사람이 단 댓글이 보관된 글 안에 있으면 그 사람이
-- 탈퇴할 때 purge_user_data가 보관함 안의 그 사람 댓글도 지운다.
-- ============================================================================

create table if not exists public.archived_content (
  id bigint generated always as identity primary key,
  source_table text not null check (source_table in ('posts', 'companion_posts')),
  source_id uuid not null,
  author_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  snapshot jsonb not null,
  children jsonb not null default '{}'::jsonb,
  original_created_at timestamptz,
  archived_at timestamptz not null default now(),
  unique (source_table, source_id)
);
create index if not exists archived_content_author_idx on public.archived_content (author_id);
create index if not exists archived_content_archived_at_idx on public.archived_content (archived_at desc);

alter table public.archived_content enable row level security;
revoke all on public.archived_content from public, anon, authenticated;

-- ── 옮기는 함수(트리거와 처음 한 번의 정리가 쓴다) ────────────────────────────
create or replace function public.archive_post_row(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  p public.posts%rowtype;
begin
  select * into p from public.posts where id = p_id for update;
  if not found then return; end if;

  insert into public.archived_content (source_table, source_id, author_id, reason, snapshot, children, original_created_at)
  values (
    'posts', p.id, p.author_id, p_reason, to_jsonb(p),
    jsonb_build_object(
      'comments', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from public.comments c where c.post_id = p.id), '[]'::jsonb),
      'post_images', coalesce((select jsonb_agg(to_jsonb(i)) from public.post_images i where i.post_id = p.id), '[]'::jsonb)
    ),
    p.created_at
  )
  on conflict (source_table, source_id) do nothing;

  delete from public.posts where id = p.id; -- 댓글·이미지 정보는 CASCADE로 함께 사라진다(위에서 보관함에 담았다)
end;
$fn$;

create or replace function public.archive_companion_row(p_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  c public.companion_posts%rowtype;
begin
  select * into c from public.companion_posts where id = p_id for update;
  if not found then return false; end if;

  -- 성사된 적 있거나 지원·채팅·정산·후기가 하나라도 있으면 옮기지 않는다
  if c.matched_at is not null
     or exists (select 1 from public.companion_applications where post_id = c.id)
     or exists (select 1 from public.companion_messages where post_id = c.id)
     or exists (select 1 from public.companion_expenses where post_id = c.id)
     or exists (select 1 from public.companion_reviews where post_id = c.id) then
    return false;
  end if;

  insert into public.archived_content (source_table, source_id, author_id, reason, snapshot, children, original_created_at)
  values ('companion_posts', c.id, c.author_id, p_reason, to_jsonb(c), '{}'::jsonb, c.created_at)
  on conflict (source_table, source_id) do nothing;

  delete from public.companion_posts where id = c.id;
  return true;
end;
$fn$;

revoke all on function public.archive_post_row(uuid, text) from public, anon, authenticated;
revoke all on function public.archive_companion_row(uuid, text) from public, anon, authenticated;

-- ── 삭제하는 순간 옮기는 트리거 ──────────────────────────────────────────────
create or replace function public.trg_archive_deleted_post()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  perform public.archive_post_row(new.id, 'user_deleted');
  return null;
end;
$fn$;

create or replace function public.trg_archive_cancelled_companion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  perform public.archive_companion_row(new.id, 'user_cancelled');
  return null;
end;
$fn$;

drop trigger if exists posts_archive_on_delete on public.posts;
create trigger posts_archive_on_delete
  after update of deleted_at on public.posts
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.trg_archive_deleted_post();

drop trigger if exists companion_posts_archive_on_cancel on public.companion_posts;
create trigger companion_posts_archive_on_cancel
  after update of status on public.companion_posts
  for each row
  when (old.status is distinct from new.status and new.status = 'cancelled')
  execute function public.trg_archive_cancelled_companion();

revoke all on function public.trg_archive_deleted_post() from public, anon, authenticated;
revoke all on function public.trg_archive_cancelled_companion() from public, anon, authenticated;

-- ── 이미 숨김 처리돼 있던 것을 한 번 옮긴다 ──────────────────────────────────
do $$
declare
  r record;
begin
  for r in select id from public.posts where deleted_at is not null loop
    perform public.archive_post_row(r.id, 'user_deleted');
  end loop;
  for r in select id from public.companion_posts where status = 'cancelled' loop
    perform public.archive_companion_row(r.id, 'user_cancelled');
  end loop;
end $$;

-- ── 운영자가 보관함을 읽는 함수 ──────────────────────────────────────────────
create or replace function public.admin_list_archived_content(p_limit int default 50, p_offset int default 0)
returns table (
  id bigint, source_table text, source_id uuid, author_id uuid, author_name text, author_handle text,
  reason text, archived_at timestamptz, original_created_at timestamptz, preview text, comment_count int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
    select a.id, a.source_table, a.source_id, a.author_id, p.display_name, p.handle, a.reason, a.archived_at, a.original_created_at,
           left(coalesce(a.snapshot->>'body', a.snapshot->>'title', ''), 200),
           jsonb_array_length(coalesce(a.children->'comments', '[]'::jsonb))
    from public.archived_content a
    left join public.profiles p on p.id = a.author_id
    order by a.archived_at desc
    limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end;
$fn$;

create or replace function public.admin_get_archived_content(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  result jsonb;
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select jsonb_build_object('snapshot', a.snapshot, 'children', a.children, 'reason', a.reason, 'archived_at', a.archived_at)
    into result from public.archived_content a where a.id = p_id;
  return result;
end;
$fn$;

revoke all on function public.admin_list_archived_content(int, int) from public, anon;
revoke all on function public.admin_get_archived_content(bigint) from public, anon;
grant execute on function public.admin_list_archived_content(int, int) to authenticated;
grant execute on function public.admin_get_archived_content(bigint) to authenticated;

-- ── 탈퇴할 때 보관함 속 그 사람의 댓글도 지운다 ──────────────────────────────
create or replace function public.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'admin accounts cannot be purged' using errcode = '42501';
  end if;

  update public.expenses set paid_by = null where paid_by = p_user_id;
  update public.itinerary_items set created_by = null where created_by = p_user_id;
  update public.reports set resolver_id = null where resolver_id = p_user_id;
  update public.moderation_events set actor_id = null where actor_id = p_user_id;

  -- 다른 사람이 보관한 글 안에 있는 이 사람의 댓글
  update public.archived_content
     set children = jsonb_set(
           children, '{comments}',
           coalesce((select jsonb_agg(c) from jsonb_array_elements(children->'comments') c where c->>'author_id' <> p_user_id::text), '[]'::jsonb)
         )
   where source_table = 'posts' and children ? 'comments';

  delete from public.profiles where id = p_user_id; -- 이 사람이 쓴 보관함 항목은 author_id CASCADE로 함께 삭제
end;
$fn$;

revoke all on function public.purge_user_data(uuid) from public, anon, authenticated;
grant execute on function public.purge_user_data(uuid) to service_role;
