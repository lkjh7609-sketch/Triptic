-- ============================================================================
-- 0077: 도시 채널 2단계 — 글 분류·태그·조회수·고정(공식 가이드)·Q&A 채택 답변·인기 태그.
-- (사용자 결정 2026-10-03)
--  · 분류 4가지: story(여행기·후기) / qna(질문·Q&A) / tips(여행 꿀팁·환전) / food(로컬 맛집·숙소). 기존 글은 story.
--  · 태그: 글마다 최대 3개, 서버(create_moderated_post)만 넣는다 — 자유 입력이라 본문처럼 moderate-content가 먼저 심사해야 해서
--    작성자가 직접 UPDATE하지 못하게 guard 트리거에서 잠근다. 분류도 올린 뒤에는 바꿀 수 없다(사용자 결정, 채택 답변과의 일관성).
--    정렬 기준인 like_count·comment_count·report_count도 작성자가 직접 못 바꾸게 같이 잠근다.
--  · 조회수: 로그인한 사용자만, 글마다 한 번(post_views). 비로그인 읽기는 그대로 열려 있지만 수에는 안 넣는다.
--  · 고정(pinned_at): 관리자가 도시별 글 1개를 '트립틱 공식 필독 가이드'로 지정(도시당 1개, 부분 유니크 인덱스).
--  · 채택 답변(accepted_comment_id): qna 글의 작성자가 댓글 하나를 채택(자기 댓글은 불가). set_post_accepted_comment()로만 바뀐다.
--  · 인기 태그: destination_popular_tags() — 그 도시 공개 글의 태그 사용 횟수 상위 N개.
-- ============================================================================

-- ── 1) 컬럼 ─────────────────────────────────────────────────────────────────
alter table public.posts
  add column if not exists category text not null default 'story',
  add column if not exists tags text[] not null default '{}',
  add column if not exists view_count integer not null default 0,
  add column if not exists pinned_at timestamptz,
  add column if not exists accepted_comment_id uuid references public.comments(id) on delete set null;

alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts add constraint posts_category_check
  check (category in ('story', 'qna', 'tips', 'food'));

alter table public.posts drop constraint if exists posts_tags_check;
alter table public.posts add constraint posts_tags_check
  check (cardinality(tags) <= 3);

-- 도시당 고정 글은 하나
create unique index if not exists posts_one_pinned_per_destination
  on public.posts (destination_id) where pinned_at is not null;

-- 도시 채널의 분류 탭·태그 검색
create index if not exists posts_destination_category_created_idx
  on public.posts (destination_id, category, created_at desc) where status = 'published' and deleted_at is null;
create index if not exists posts_tags_gin_idx on public.posts using gin (tags);

-- ── 2) 작성자가 직접 바꿀 수 없는 컬럼 잠그기(기존 guard 확장) ───────────────────
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
    if (new.author_id, new.body, new.status, new.destination_id, new.trip_id, new.language,
        new.category, new.tags, new.view_count, new.pinned_at, new.accepted_comment_id,
        new.like_count, new.comment_count, new.report_count)
       is distinct from
       (old.author_id, old.body, old.status, old.destination_id, old.trip_id, old.language,
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

-- ── 3) 게시 함수: 분류·태그를 함께 저장하는 새 버전(예전 9개 인자 버전은 그대로 둔다) ──────────
create or replace function public.create_moderated_post(
  p_author_id uuid,
  p_destination_id uuid,
  p_trip_id uuid,
  p_body text,
  p_language text,
  p_images jsonb,
  p_status text,
  p_score numeric,
  p_categories jsonb,
  p_category text,
  p_tags text[]
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post_id uuid;
  v_category text := coalesce(p_category, 'story');
  v_tags text[];
begin
  if v_category not in ('story', 'qna', 'tips', 'food') then
    raise exception 'invalid category %', v_category;
  end if;
  -- 태그 정리: 앞뒤 공백·앞의 #·안의 연속 공백 정리 → 빈 것·20자 초과 제거 → 중복 제거(처음 순서 유지) → 3개까지
  select coalesce(array_agg(t order by first_pos), '{}') into v_tags
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

  v_post_id := public.create_moderated_post(
    p_author_id, p_destination_id, p_trip_id, p_body, p_language, p_images, p_status, p_score, p_categories
  );
  update public.posts set category = v_category, tags = v_tags where id = v_post_id;
  return v_post_id;
end;
$fn$;
revoke all on function public.create_moderated_post(uuid, uuid, uuid, text, text, jsonb, text, numeric, jsonb, text, text[]) from public, anon, authenticated;
grant execute on function public.create_moderated_post(uuid, uuid, uuid, text, text, jsonb, text, numeric, jsonb, text, text[]) to service_role;

-- ── 4) 조회수 — 로그인한 사용자만, 글마다 한 번 ─────────────────────────────────
create table if not exists public.post_views (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_views enable row level security;
-- 정책 없음: 직접 읽고 쓰지 못한다(record_post_view 함수로만)

create or replace function public.record_post_view(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_inserted integer;
begin
  if auth.uid() is null then
    return;
  end if;
  if not exists (select 1 from public.posts where id = p_post_id and status = 'published' and deleted_at is null) then
    return;
  end if;
  insert into public.post_views (post_id, user_id) values (p_post_id, auth.uid()) on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    update public.posts set view_count = view_count + 1 where id = p_post_id;
  end if;
end;
$fn$;
revoke all on function public.record_post_view(uuid) from public, anon;
grant execute on function public.record_post_view(uuid) to authenticated;

-- ── 5) 고정(관리자) ─────────────────────────────────────────────────────────
create or replace function public.set_post_pinned(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_destination uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  select destination_id into v_destination from public.posts where id = p_post_id and status = 'published' and deleted_at is null;
  if not found then
    raise exception 'post not found';
  end if;
  if p_pinned then
    if v_destination is null then
      raise exception 'post has no destination';
    end if;
    -- 도시당 하나 — 이미 고정된 글이 있으면 풀고 이 글로 바꾼다
    update public.posts set pinned_at = null where destination_id = v_destination and pinned_at is not null and id <> p_post_id;
    update public.posts set pinned_at = now() where id = p_post_id;
  else
    update public.posts set pinned_at = null where id = p_post_id;
  end if;
end;
$fn$;
revoke all on function public.set_post_pinned(uuid, boolean) from public, anon;
grant execute on function public.set_post_pinned(uuid, boolean) to authenticated;

-- ── 6) 채택 답변 — qna 글의 작성자가 댓글 하나를(자기 댓글 제외), null이면 채택 취소 ─────────
create or replace function public.set_post_accepted_comment(p_post_id uuid, p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_author uuid;
  v_category text;
  v_comment_author uuid;
begin
  select author_id, category into v_author, v_category
  from public.posts where id = p_post_id and status = 'published' and deleted_at is null;
  if not found or v_author is distinct from auth.uid() then
    raise exception 'only the author can accept an answer' using errcode = '42501';
  end if;
  if v_category <> 'qna' then
    raise exception 'only qna posts can have an accepted answer';
  end if;
  if p_comment_id is not null then
    select author_id into v_comment_author
    from public.comments
    where id = p_comment_id and post_id = p_post_id and status = 'published' and deleted_at is null;
    if not found then
      raise exception 'comment not found';
    end if;
    if v_comment_author = auth.uid() then
      raise exception 'cannot accept your own comment' using errcode = '42501';
    end if;
  end if;
  update public.posts set accepted_comment_id = p_comment_id where id = p_post_id;
end;
$fn$;
revoke all on function public.set_post_accepted_comment(uuid, uuid) from public, anon;
grant execute on function public.set_post_accepted_comment(uuid, uuid) to authenticated;

-- ── 7) 인기 태그 — 그 도시 공개 글의 태그 사용 횟수 상위 N개 ───────────────────────
create or replace function public.destination_popular_tags(p_destination_id uuid, p_limit integer default 6)
returns table (tag text, uses bigint)
language sql
stable
set search_path = public, pg_temp
as $fn$
  select t.tag, count(*) as uses
  from public.posts p, unnest(p.tags) as t(tag)
  where p.destination_id = p_destination_id and p.status = 'published' and p.deleted_at is null
  group by t.tag
  order by uses desc, t.tag
  limit least(greatest(p_limit, 1), 20);
$fn$;
revoke all on function public.destination_popular_tags(uuid, integer) from public;
grant execute on function public.destination_popular_tags(uuid, integer) to anon, authenticated;
