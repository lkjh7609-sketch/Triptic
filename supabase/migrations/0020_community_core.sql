-- ============================================================================
-- 0020: Phase 5 커뮤니티 — 핵심 스키마 (여행지/글/댓글/좋아요/구독)
-- 출처: docs/specs/06-community.md §2, §3, §4, §6, §7
--
-- ⚠️ 06-community.md §5(안전장치)는 0021_community_safety.sql에서 같은
-- 세션·같은 PR로 함께 적용한다 — 절대 이 파일만 단독으로 배포해 피드/글쓰기를
-- 열지 않는다(App Store 1.2 리젝 리스크 R4).
-- ============================================================================

-- ── 0) 관리자 역할(§9 운영 콘솔 접근 제어 + 이 파일의 admin 정책들이 참조) ──
alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('user', 'admin'));

-- ── 0-1) 차단(blocks) 테이블을 먼저 만든다 — 아래 posts/comments RLS가
-- 참조한다(§4). reports/moderation_events는 0021_community_safety.sql에서.
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
create policy "read own blocks"
  on public.blocks for select using (blocker_id = auth.uid());
create policy "insert own blocks"
  on public.blocks for insert with check (blocker_id = auth.uid());
create policy "delete own blocks"
  on public.blocks for delete using (blocker_id = auth.uid());
grant select, insert, delete on public.blocks to authenticated;

-- ── 1) 여행지 (사용자가 임의로 만들 수 없다 — 큐레이션 전용, §2) ────────────
create table public.destinations (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  country_code char(2) not null,
  lat          double precision not null,
  lng          double precision not null,
  timezone     text not null,
  currency     text,
  cover_url    text,
  is_featured  boolean not null default false,
  sort_order   int not null default 0,
  post_count   int not null default 0,
  created_at   timestamptz not null default now()
);

create table public.destination_translations (
  destination_id uuid not null references public.destinations(id) on delete cascade,
  locale         text not null check (locale in ('ko', 'en', 'zh-CN')),
  name           text not null,
  description    text,
  primary key (destination_id, locale)
);

-- ── 2) 글/이미지/댓글/좋아요/구독 (§3) ──────────────────────────────────────
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations(id) on delete restrict,
  author_id      uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 2000),
  language       text,
  trip_id        uuid references public.trips(id) on delete set null,
  status         text not null default 'published'
                 check (status in ('published', 'pending_review', 'hidden', 'removed')),
  like_count     int not null default 0,
  comment_count  int not null default 0,
  report_count   int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create index posts_destination_created_idx on public.posts (destination_id, created_at desc)
  where status = 'published' and deleted_at is null;
create index posts_author_created_idx on public.posts (author_id, created_at desc);

create table public.post_images (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.posts(id) on delete cascade,
  storage_path text not null,
  width        int,
  height       int,
  position     int not null default 0,
  status       text not null default 'published'
               check (status in ('published', 'pending_review', 'removed'))
);

create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  parent_id  uuid references public.comments(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  status     text not null default 'published'
             check (status in ('published', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index comments_post_created_idx on public.comments (post_id, created_at);

create table public.reactions (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table public.destination_follows (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  destination_id uuid not null references public.destinations(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, destination_id)
);

-- ── 3) 다른 사용자의 공개 프로필 조회용 뷰 ───────────────────────────────────
-- profiles는 본인 행만 읽을 수 있는 RLS(0000_reconcile_legacy_schema.sql,
-- "Users can view own profile")가 이미 있다 — 피드에 글쓴이 닉네임/아바타를
-- 보여주려면 다른 사용자 행도 읽어야 하므로, 안전한 컬럼만 노출하는 뷰를
-- 따로 둔다. 이 뷰는 postgres(테이블 소유자, RLS 우회)가 정의하므로 기반
-- 테이블의 제한적 RLS와 무관하게 아래 GRANT로만 접근이 통제된다.
create view public.community_profiles as
select id, handle, display_name, avatar_url, bio
from public.profiles;

grant select on public.community_profiles to anon, authenticated;

-- ── 4) RLS ───────────────────────────────────────────────────────────────
-- 비로그인도 커뮤니티 "읽기"는 가능하다(02-screens.md §6) — anon에도 select 부여.

alter table public.destinations enable row level security;
create policy "public read destinations" on public.destinations
  for select using (true);
create policy "admin write destinations" on public.destinations
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
grant select on public.destinations to anon, authenticated;

alter table public.destination_translations enable row level security;
create policy "public read destination translations" on public.destination_translations
  for select using (true);
create policy "admin write destination translations" on public.destination_translations
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
grant select on public.destination_translations to anon, authenticated;

alter table public.posts enable row level security;

-- 읽기: 게시 상태이고, 내가 차단한 사용자의 글이 아닐 것(§4 그대로)
create policy "read published posts"
  on public.posts for select
  using (
    status = 'published'
    and deleted_at is null
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = posts.author_id
    )
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = posts.author_id and b.blocked_id = auth.uid()
    )
  );

-- 본인 글은 상태와 무관하게 볼 수 있다(숨김 처리된 이유를 알아야 하므로)
create policy "read own posts"
  on public.posts for select using (author_id = auth.uid());

-- 운영자는 신고/자동필터 큐를 위해 전체를 본다(§9)
create policy "admin read all posts"
  on public.posts for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "insert own posts"
  on public.posts for insert with check (author_id = auth.uid());

create policy "update own posts"
  on public.posts for update using (author_id = auth.uid())
  with check (author_id = auth.uid() and status = 'published');

-- 운영자 처리(승인/숨김/삭제) — 큐 화면에서 상태를 바꾸는 유일한 경로
create policy "admin update any post"
  on public.posts for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "soft delete own posts"
  on public.posts for delete using (author_id = auth.uid());

grant select, insert, update, delete on public.posts to authenticated;
grant select on public.posts to anon;

alter table public.post_images enable row level security;
create policy "read images of visible posts"
  on public.post_images for select
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_images.post_id
        and (
          p.author_id = auth.uid()
          or (exists (select 1 from public.profiles ap where ap.id = auth.uid() and ap.role = 'admin'))
          or (
            p.status = 'published' and p.deleted_at is null
            and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.author_id)
            and not exists (select 1 from public.blocks b where b.blocker_id = p.author_id and b.blocked_id = auth.uid())
          )
        )
    )
  );
create policy "insert own post images"
  on public.post_images for insert
  with check (exists (select 1 from public.posts p where p.id = post_images.post_id and p.author_id = auth.uid()));
create policy "delete own post images"
  on public.post_images for delete
  using (exists (select 1 from public.posts p where p.id = post_images.post_id and p.author_id = auth.uid()));
grant select, insert, delete on public.post_images to authenticated;
grant select on public.post_images to anon;

alter table public.comments enable row level security;

-- 동일한 차단 조건을 comments에도 적용한다(§4 지시)
create policy "read published comments"
  on public.comments for select
  using (
    status = 'published'
    and deleted_at is null
    and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = comments.author_id)
    and not exists (select 1 from public.blocks b where b.blocker_id = comments.author_id and b.blocked_id = auth.uid())
  );
create policy "read own comments"
  on public.comments for select using (author_id = auth.uid());
create policy "admin read all comments"
  on public.comments for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "insert own comments"
  on public.comments for insert with check (author_id = auth.uid());
create policy "admin update any comment"
  on public.comments for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "soft delete own comments"
  on public.comments for delete using (author_id = auth.uid());
grant select, insert, update, delete on public.comments to authenticated;
grant select on public.comments to anon;

alter table public.reactions enable row level security;
create policy "read own reactions"
  on public.reactions for select using (user_id = auth.uid());
create policy "insert own reactions"
  on public.reactions for insert with check (user_id = auth.uid());
create policy "delete own reactions"
  on public.reactions for delete using (user_id = auth.uid());
grant select, insert, delete on public.reactions to authenticated;

alter table public.destination_follows enable row level security;
create policy "read own follows"
  on public.destination_follows for select using (user_id = auth.uid());
create policy "insert own follows"
  on public.destination_follows for insert with check (user_id = auth.uid());
create policy "delete own follows"
  on public.destination_follows for delete using (user_id = auth.uid());
grant select, insert, delete on public.destination_follows to authenticated;

-- ── 5) 비정규화 카운터 트리거 ────────────────────────────────────────────────
create or replace function public.bump_post_like_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'INSERT' and new.target_type = 'post' then
    update public.posts set like_count = like_count + 1 where id = new.target_id;
  elsif tg_op = 'DELETE' and old.target_type = 'post' then
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.target_id;
  end if;
  return coalesce(new, old);
end;
$fn$;
create trigger reactions_bump_like_count
  after insert or delete on public.reactions
  for each row execute function public.bump_post_like_count();

create or replace function public.bump_post_comment_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
  end if;
  return coalesce(new, old);
end;
$fn$;
create trigger comments_bump_comment_count
  after insert or update or delete on public.comments
  for each row execute function public.bump_post_comment_count();

create or replace function public.bump_destination_post_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  was_counted boolean;
  is_counted boolean;
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' and new.deleted_at is null then
      update public.destinations set post_count = post_count + 1 where id = new.destination_id;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.status = 'published' and old.deleted_at is null then
      update public.destinations set post_count = greatest(post_count - 1, 0) where id = old.destination_id;
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    was_counted := (old.status = 'published' and old.deleted_at is null);
    is_counted := (new.status = 'published' and new.deleted_at is null);
    if was_counted and not is_counted then
      update public.destinations set post_count = greatest(post_count - 1, 0) where id = old.destination_id;
    elsif not was_counted and is_counted then
      update public.destinations set post_count = post_count + 1 where id = new.destination_id;
    end if;
    return new;
  end if;
  return null;
end;
$fn$;
create trigger posts_bump_destination_count
  after insert or update or delete on public.posts
  for each row execute function public.bump_destination_post_count();

-- ── 6) Storage: post-images 버킷(§7 — 공개 읽기, 인증 쓰기) ─────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- 경로 규칙: {user_id}/{uuid}.webp — 본인 폴더에만 쓰기, 읽기는 공개 버킷이라
-- 버킷 자체가 이미 공개(별도 select 정책 불필요, public=true).
create policy "post-images owner insert" on storage.objects for insert
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "post-images owner delete" on storage.objects for delete
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
