-- ============================================================================
-- 0032: 동행찾기(Companion Matching) — 모집글/신청/QR 상호 검증
-- 모더레이션(06-community.md §5 원칙)과 같은 PR로 배포한다 — 0020/0021이
-- 기능+안전을 같이 배포했던 전례를 따른다. 0023/0029처럼 뒤늦게 우회 경로를
-- 막는 2차 하드닝을 반복하지 않기 위해, RLS로 직접 열리는 표면을 최소화하고
-- (post/application의 상태 전이는 전부 RPC 경유) 처음부터 좁게 설계했다.
-- ============================================================================

-- ── 1) 테이블 ──────────────────────────────────────────────────────────────
create table public.companion_posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null references public.profiles(id) on delete cascade,
  destination_id uuid references public.destinations(id) on delete restrict,
  title          text not null check (char_length(title) between 1 and 100),
  body           text not null check (char_length(body) between 1 and 2000),
  start_date     date not null,
  end_date       date not null,
  group_size     int not null check (group_size between 2 and 20), -- 주최자 포함 총원
  status         text not null default 'pending_review'
                 check (status in ('pending_review', 'recruiting', 'matched', 'closed', 'cancelled', 'hidden', 'removed')),
  report_count   int not null default 0,
  matched_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,
  check (end_date >= start_date)
);
create index companion_posts_status_created_idx on public.companion_posts (status, created_at desc) where deleted_at is null;
create index companion_posts_author_idx on public.companion_posts (author_id, created_at desc);

create table public.companion_applications (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.companion_posts(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  message      text check (char_length(message) <= 500),
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'rejected', 'withdrawn', 'removed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (post_id, applicant_id)
);
create index companion_applications_post_idx on public.companion_applications (post_id, status);

-- select 정책이 아예 없다(의도) — 아래 두 RPC로만 접근한다.
create table public.companion_qr_tokens (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.companion_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null unique,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

-- ── 2) 헬퍼(0007 can_access_trip과 동일한 형태) — 교차 테이블 RLS 순환 회피 ──
create or replace function public.is_companion_author(p_post_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select exists (select 1 from public.companion_posts p where p.id = p_post_id and p.author_id = auth.uid());
$fn$;
revoke all on function public.is_companion_author(uuid) from public;
grant execute on function public.is_companion_author(uuid) to authenticated;

create or replace function public.is_companion_member(p_post_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $fn$
  select exists (select 1 from public.companion_posts p where p.id = p_post_id and p.author_id = auth.uid())
      or exists (select 1 from public.companion_applications a
                 where a.post_id = p_post_id and a.applicant_id = auth.uid() and a.status = 'accepted');
$fn$;
revoke all on function public.is_companion_member(uuid) from public;
grant execute on function public.is_companion_member(uuid) to authenticated;

-- ── 3) RLS: companion_posts ────────────────────────────────────────────────
alter table public.companion_posts enable row level security;

create policy "read recruiting companion posts" on public.companion_posts for select
  using (
    status = 'recruiting' and deleted_at is null
    and not exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = companion_posts.author_id)
    and not exists (select 1 from public.blocks b where b.blocker_id = companion_posts.author_id and b.blocked_id = (select auth.uid()))
  );
create policy "read own companion posts" on public.companion_posts for select
  using (author_id = (select auth.uid()));
create policy "read companion posts as member" on public.companion_posts for select
  using (public.is_companion_member(id));
create policy "admin read all companion posts" on public.companion_posts for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "insert own companion posts" on public.companion_posts for insert
  with check (author_id = (select auth.uid()) and status = 'pending_review');
create policy "update own companion posts" on public.companion_posts for update
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "admin update any companion post" on public.companion_posts for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

grant select, insert, update on public.companion_posts to authenticated;
-- anon grant 없음 — 동행찾기는 로그인 사용자 전용(AppShell이 이미 전체 앱을 로그인
-- 사용자로만 막아두므로 실질적으로도 anon이 도달할 일이 없다).

-- ── 4) RLS: companion_applications ─────────────────────────────────────────
alter table public.companion_applications enable row level security;

create policy "read own companion applications" on public.companion_applications for select
  using (applicant_id = (select auth.uid()));
create policy "read applications for my companion posts" on public.companion_applications for select
  using (public.is_companion_author(post_id) and status <> 'removed');
create policy "admin read all companion applications" on public.companion_applications for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "admin update any companion application" on public.companion_applications for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

grant select, update on public.companion_applications to authenticated;
-- insert 권한 없음(전부 create_moderated_companion_application RPC 경유).
-- 일반 사용자용 update 정책도 없음(수락/거절/철회는 아래 RPC 경유) — admin
-- 정책만 이 grant를 실제로 쓴다.

-- ── 5) companion_qr_tokens — 전면 잠금 ─────────────────────────────────────
alter table public.companion_qr_tokens enable row level security;
revoke all on public.companion_qr_tokens from public, anon, authenticated;
-- 정책 없음(의도적) — get_my_companion_qr_token / verify_companion_qr_token만
-- 이 테이블을 SECURITY DEFINER로 우회해서 만진다.

-- ── 6) 작성자 컬럼 가드 트리거 확장(0029 guard_author_content_update) ──────
create or replace function public.guard_author_content_update()
returns trigger language plpgsql set search_path = public, pg_temp
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
  elsif tg_table_name = 'companion_posts' then
    if (new.author_id, new.title, new.body, new.destination_id, new.start_date, new.end_date,
        new.group_size, new.status, new.matched_at)
       is distinct from
       (old.author_id, old.title, old.body, old.destination_id, old.start_date, old.end_date,
        old.group_size, old.status, old.matched_at) then
      raise exception 'only deleted_at can be changed by the author' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists companion_posts_guard_author_update on public.companion_posts;
create trigger companion_posts_guard_author_update
  before update on public.companion_posts
  for each row execute function public.guard_author_content_update();

-- ── 7) 신고 파이프라인 확장 ─────────────────────────────────────────────────
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'user', 'image', 'companion_post', 'companion_application'));

create or replace function public.check_report_threshold() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  distinct_reporters int;
  was_published boolean := false;
begin
  select count(distinct reporter_id) into distinct_reporters
  from public.reports where target_type = new.target_type and target_id = new.target_id;

  if new.target_type = 'post' then
    update public.posts set report_count = distinct_reporters where id = new.target_id;
    if distinct_reporters >= 3 then
      update public.posts set status = 'hidden'
        where id = new.target_id and status = 'published'
        returning true into was_published;
      if was_published then
        insert into public.moderation_events (target_type, target_id, action, source)
        values ('post', new.target_id, 'hidden', 'report_threshold');
      end if;
    end if;
  elsif new.target_type = 'comment' then
    if distinct_reporters >= 3 then
      update public.comments set status = 'hidden'
        where id = new.target_id and status = 'published'
        returning true into was_published;
      if was_published then
        insert into public.moderation_events (target_type, target_id, action, source)
        values ('comment', new.target_id, 'hidden', 'report_threshold');
      end if;
    end if;
  elsif new.target_type = 'companion_post' then
    -- 'recruiting'일 때만 자동 숨김 — 이미 매칭(matched)된 모임까지 몰아치기
    -- 신고로 조용히 숨기면 QR 상호검증이 여행 중에 끊길 수 있다. matched 상태
    -- 신고는 운영 큐(reports.status='open')로만 넘어가고 자동 hidden 안 된다.
    update public.companion_posts set report_count = distinct_reporters where id = new.target_id;
    if distinct_reporters >= 3 then
      update public.companion_posts set status = 'hidden'
        where id = new.target_id and status = 'recruiting'
        returning true into was_published;
      if was_published then
        insert into public.moderation_events (target_type, target_id, action, source)
        values ('companion_post', new.target_id, 'hidden', 'report_threshold');
      end if;
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function public.check_report_threshold() from public;

-- ── 8) 모더레이션 게시 RPC(service_role 전용, 0029 형태) ───────────────────
create or replace function public.create_moderated_companion_post(
  p_author_id uuid, p_destination_id uuid, p_title text, p_body text,
  p_start_date date, p_end_date date, p_group_size int,
  p_status text, p_score numeric, p_categories jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
  v_row_status text;
begin
  if p_author_id is null then raise exception 'author required'; end if;
  if p_status not in ('published', 'pending_review', 'removed') then raise exception 'invalid status %', p_status; end if;
  v_row_status := case p_status when 'published' then 'recruiting' else p_status end;

  insert into public.companion_posts (author_id, destination_id, title, body, start_date, end_date, group_size, status)
  values (p_author_id, p_destination_id, p_title, p_body, p_start_date, p_end_date, p_group_size, v_row_status)
  returning id into v_id;

  if p_status <> 'published' then
    insert into public.moderation_events (target_type, target_id, action, source, score, categories)
    values ('companion_post', v_id, case when p_status = 'removed' then 'auto_blocked' else 'auto_flagged' end, 'classifier', p_score, p_categories);
  end if;
  return v_id;
end;
$fn$;
revoke all on function public.create_moderated_companion_post(uuid, uuid, text, text, date, date, int, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.create_moderated_companion_post(uuid, uuid, text, text, date, date, int, text, numeric, jsonb) to service_role;

create or replace function public.create_moderated_companion_application(
  p_applicant_id uuid, p_post_id uuid, p_message text, p_status text, p_score numeric, p_categories jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
  v_post record;
begin
  if p_applicant_id is null then raise exception 'applicant required'; end if;
  if p_status not in ('pending', 'removed') then raise exception 'invalid status %', p_status; end if;

  select * into v_post from public.companion_posts where id = p_post_id;
  if v_post is null or v_post.status <> 'recruiting' then raise exception 'this listing is not accepting applicants'; end if;
  if v_post.author_id = p_applicant_id then raise exception 'organizer cannot apply to their own listing'; end if;
  if exists (select 1 from public.blocks b
             where (b.blocker_id = p_applicant_id and b.blocked_id = v_post.author_id)
                or (b.blocker_id = v_post.author_id and b.blocked_id = p_applicant_id)) then
    raise exception 'cannot apply to this listing';
  end if;

  insert into public.companion_applications (post_id, applicant_id, message, status)
  values (p_post_id, p_applicant_id, p_message, p_status)
  returning id into v_id;

  if p_status <> 'pending' then
    insert into public.moderation_events (target_type, target_id, action, source, score, categories)
    values ('companion_application', v_id, 'auto_blocked', 'classifier', p_score, p_categories);
  end if;
  return v_id;
exception
  when unique_violation then raise exception 'you already applied to this listing';
end;
$fn$;
revoke all on function public.create_moderated_companion_application(uuid, uuid, text, text, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.create_moderated_companion_application(uuid, uuid, text, text, numeric, jsonb) to service_role;

-- ── 9) self-contained-auth RPC(authenticated 직접 호출, 0007 형태) ─────────
create or replace function public.respond_companion_application(p_application_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_app record;
  v_post record;
  v_accepted_count int;
begin
  select * into v_app from public.companion_applications where id = p_application_id for update;
  if v_app is null then raise exception 'application not found'; end if;
  select * into v_post from public.companion_posts where id = v_app.post_id for update;
  if v_post is null then raise exception 'companion post not found'; end if;
  if v_post.author_id <> (select auth.uid()) then raise exception 'only the organizer can respond to applications' using errcode = '42501'; end if;
  if v_post.status <> 'recruiting' then raise exception 'post is not recruiting'; end if;
  if v_app.status <> 'pending' then raise exception 'application already resolved'; end if;

  if p_accept then
    select count(*) into v_accepted_count from public.companion_applications where post_id = v_post.id and status = 'accepted';
    if v_accepted_count + 1 > v_post.group_size - 1 then raise exception 'group is already full'; end if;
    update public.companion_applications set status = 'accepted', updated_at = now() where id = p_application_id;
  else
    update public.companion_applications set status = 'rejected', updated_at = now() where id = p_application_id;
  end if;
end;
$fn$;
revoke all on function public.respond_companion_application(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_companion_application(uuid, boolean) to authenticated;

create or replace function public.withdraw_companion_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_app record;
begin
  select * into v_app from public.companion_applications where id = p_application_id for update;
  if v_app is null then raise exception 'application not found'; end if;
  if v_app.applicant_id <> (select auth.uid()) then raise exception 'only the applicant can withdraw' using errcode = '42501'; end if;
  if v_app.status not in ('pending', 'accepted') then raise exception 'application cannot be withdrawn'; end if;

  update public.companion_applications set status = 'withdrawn', updated_at = now() where id = p_application_id;

  -- 매칭 확정 후 탈퇴라면(= 이전 상태가 accepted였다면) QR 토큰도 즉시 무효화한다
  -- — 그룹을 나간 사람이 계속 "우리 멤버 맞음"으로 검증되면 안 된다.
  update public.companion_qr_tokens
    set revoked_at = now()
    where post_id = v_app.post_id and user_id = v_app.applicant_id and revoked_at is null;
end;
$fn$;
revoke all on function public.withdraw_companion_application(uuid) from public, anon, authenticated;
grant execute on function public.withdraw_companion_application(uuid) to authenticated;

create or replace function public.finalize_companion_match(p_post_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post record;
  v_accepted_count int;
begin
  select * into v_post from public.companion_posts where id = p_post_id for update;
  if v_post is null then raise exception 'companion post not found'; end if;
  if v_post.author_id <> (select auth.uid()) then raise exception 'only the organizer can finalize this match' using errcode = '42501'; end if;
  if v_post.status <> 'recruiting' then raise exception 'post is not recruiting'; end if;

  select count(*) into v_accepted_count from public.companion_applications where post_id = p_post_id and status = 'accepted';
  if v_accepted_count < 1 then raise exception 'need at least one accepted applicant to finalize'; end if;

  update public.companion_posts set status = 'matched', matched_at = now(), updated_at = now() where id = p_post_id;
  update public.companion_applications set status = 'rejected', updated_at = now() where post_id = p_post_id and status = 'pending';

  -- pgcrypto가 extensions 스키마에 설치돼 있고 이 함수의 search_path엔 없으므로
  -- 스키마 접두어가 필수다(안 붙이면 "function gen_random_bytes does not exist").
  insert into public.companion_qr_tokens (post_id, user_id, token)
  select p_post_id, v_post.author_id, encode(extensions.gen_random_bytes(24), 'hex')
  where not exists (select 1 from public.companion_qr_tokens where post_id = p_post_id and user_id = v_post.author_id);

  insert into public.companion_qr_tokens (post_id, user_id, token)
  select p_post_id, a.applicant_id, encode(extensions.gen_random_bytes(24), 'hex')
  from public.companion_applications a
  where a.post_id = p_post_id and a.status = 'accepted'
    and not exists (select 1 from public.companion_qr_tokens t where t.post_id = p_post_id and t.user_id = a.applicant_id);
end;
$fn$;
revoke all on function public.finalize_companion_match(uuid) from public, anon, authenticated;
grant execute on function public.finalize_companion_match(uuid) to authenticated;

create or replace function public.cancel_companion_post(p_post_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post record;
begin
  select * into v_post from public.companion_posts where id = p_post_id for update;
  if v_post is null then raise exception 'companion post not found'; end if;
  if v_post.author_id <> (select auth.uid()) then raise exception 'only the organizer can cancel this listing' using errcode = '42501'; end if;
  if v_post.status not in ('recruiting', 'matched') then raise exception 'post cannot be cancelled from its current status'; end if;
  update public.companion_posts set status = 'cancelled', updated_at = now() where id = p_post_id;
  update public.companion_applications set status = 'rejected', updated_at = now() where post_id = p_post_id and status = 'pending';
  update public.companion_qr_tokens set revoked_at = now() where post_id = p_post_id and revoked_at is null;
end;
$fn$;
revoke all on function public.cancel_companion_post(uuid) from public, anon, authenticated;
grant execute on function public.cancel_companion_post(uuid) to authenticated;

-- ── 10) QR RPC — companion_qr_tokens는 이 두 함수만 만진다 ─────────────────
create or replace function public.get_my_companion_qr_token(p_post_id uuid)
returns text language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  v_token text;
  v_status text;
begin
  select status into v_status from public.companion_posts where id = p_post_id;
  if v_status is distinct from 'matched' then raise exception 'this listing is not matched yet'; end if;
  if not public.is_companion_member(p_post_id) then raise exception 'you are not a member of this match' using errcode = '42501'; end if;

  select token into v_token from public.companion_qr_tokens
  where post_id = p_post_id and user_id = (select auth.uid()) and revoked_at is null;
  if v_token is null then raise exception 'no active qr token found for you on this match'; end if;
  return v_token;
end;
$fn$;
revoke all on function public.get_my_companion_qr_token(uuid) from public, anon;
grant execute on function public.get_my_companion_qr_token(uuid) to authenticated;

create or replace function public.verify_companion_qr_token(p_token text)
returns table (post_id uuid, title text, member_id uuid, handle text, display_name text, avatar_url text)
language plpgsql stable security definer set search_path = public, pg_temp
as $fn$
declare
  v_owner_id uuid;
  v_post_id uuid;
begin
  select t.user_id, t.post_id into v_owner_id, v_post_id
  from public.companion_qr_tokens t join public.companion_posts p on p.id = t.post_id
  where t.token = p_token and t.revoked_at is null and p.status = 'matched' and p.deleted_at is null;

  if v_owner_id is null then return; end if; -- 실패 이유를 노출하지 않는다
  if not public.is_companion_member(v_post_id) then return; end if; -- 같은 매치 멤버만 통과
  if exists (select 1 from public.blocks b
             where (b.blocker_id = (select auth.uid()) and b.blocked_id = v_owner_id)
                or (b.blocker_id = v_owner_id and b.blocked_id = (select auth.uid()))) then
    return;
  end if;

  return query
    select p.id, p.title, cp.id, cp.handle, cp.display_name, cp.avatar_url
    from public.companion_posts p join public.community_profiles cp on cp.id = v_owner_id
    where p.id = v_post_id;
end;
$fn$;
revoke all on function public.verify_companion_qr_token(text) from public, anon;
grant execute on function public.verify_companion_qr_token(text) to authenticated;
