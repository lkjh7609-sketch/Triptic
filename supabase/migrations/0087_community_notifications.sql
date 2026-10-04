-- ============================================================================
-- 0087: 커뮤니티 알림 — 내 글에 댓글, 내 댓글에 답글, 내 글·댓글에 좋아요(사용자 요청 2026-10-05)
--  · 알림은 DB 트리거가 만든다(클라이언트는 못 만든다). 보는 사람은 자기 알림만 읽고·읽음 표시하고·지울 수 있다.
--  · 자기 자신의 행동, 서로 차단한 사이, 설정에서 '커뮤니티 답글' 알림을 끈 사람에게는 만들지 않는다.
--  · 좋아요 알림은 같은 사람이 같은 대상에 한 번만(좋아요를 눌렀다 취소했다 반복해도 알림이 쌓이지 않는다).
-- ============================================================================
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('post_comment', 'comment_reply', 'post_like', 'comment_like')),
  actor_id   uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create unique index notifications_like_once_idx
  on public.notifications (user_id, kind, actor_id, post_id, coalesce(comment_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where kind in ('post_like', 'comment_like');

alter table public.notifications enable row level security;
create policy "read own notifications" on public.notifications for select using (user_id = auth.uid());
create policy "update own notifications" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own notifications" on public.notifications for delete using (user_id = auth.uid());
-- 사용자가 바꿀 수 있는 건 읽음 표시뿐
revoke insert, update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ── 만들기(트리거 전용) ─────────────────────────────────────────────────────
create or replace function public.notify_community(
  p_user uuid, p_kind text, p_actor uuid, p_post uuid, p_comment uuid
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if exists (select 1 from public.blocks b where (b.blocker_id = p_user and b.blocked_id = p_actor) or (b.blocker_id = p_actor and b.blocked_id = p_user)) then
    return;
  end if;
  if exists (select 1 from public.profiles pr where pr.id = p_user and pr.notification_prefs ->> 'communityReplies' = 'false') then
    return;
  end if;
  insert into public.notifications (user_id, kind, actor_id, post_id, comment_id)
  values (p_user, p_kind, p_actor, p_post, p_comment)
  on conflict do nothing;
end;
$fn$;
revoke all on function public.notify_community(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public.notify_on_comment() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post_author uuid;
  v_parent_author uuid;
begin
  if new.status <> 'published' or new.deleted_at is not null then return new; end if;
  select author_id into v_post_author from public.posts where id = new.post_id;
  if new.parent_id is not null then
    select author_id into v_parent_author from public.comments where id = new.parent_id;
    perform public.notify_community(v_parent_author, 'comment_reply', new.author_id, new.post_id, new.id);
  end if;
  -- 내 글에 달린 댓글·답글(이미 답글 알림을 받는 사람에게는 겹쳐 보내지 않는다)
  if v_post_author is distinct from v_parent_author then
    perform public.notify_community(v_post_author, 'post_comment', new.author_id, new.post_id, new.id);
  end if;
  return new;
end;
$fn$;
revoke all on function public.notify_on_comment() from public, anon, authenticated;
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments for each row execute function public.notify_on_comment();

create or replace function public.notify_on_reaction() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_author uuid;
  v_post uuid;
begin
  if new.target_type = 'post' then
    select author_id into v_author from public.posts where id = new.target_id and deleted_at is null;
    perform public.notify_community(v_author, 'post_like', new.user_id, new.target_id, null);
  elsif new.target_type = 'comment' then
    select author_id, post_id into v_author, v_post from public.comments where id = new.target_id and deleted_at is null;
    if v_post is not null then
      perform public.notify_community(v_author, 'comment_like', new.user_id, v_post, new.target_id);
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function public.notify_on_reaction() from public, anon, authenticated;
drop trigger if exists reactions_notify on public.reactions;
create trigger reactions_notify after insert on public.reactions for each row execute function public.notify_on_reaction();

-- ── 읽기(보낸 사람 이름·글 제목을 한 번에) ──────────────────────────────────────
create or replace function public.list_my_notifications(p_limit int default 30)
returns table (
  id uuid, kind text, actor_id uuid, actor_name text, post_id uuid, comment_id uuid,
  post_title text, post_body text, created_at timestamptz, read_at timestamptz
)
language sql security definer stable set search_path = public, pg_temp
as $fn$
  select n.id, n.kind, n.actor_id, pr.display_name, n.post_id, n.comment_id,
         p.title, left(p.body, 200), n.created_at, n.read_at
  from public.notifications n
  join public.posts p on p.id = n.post_id and p.deleted_at is null
  left join public.profiles pr on pr.id = n.actor_id
  where n.user_id = auth.uid()
  order by n.created_at desc
  limit least(greatest(p_limit, 1), 100);
$fn$;
revoke all on function public.list_my_notifications(int) from public, anon;
grant execute on function public.list_my_notifications(int) to authenticated;
