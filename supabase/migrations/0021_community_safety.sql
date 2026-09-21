-- ============================================================================
-- 0021: Phase 5 커뮤니티 — 안전장치 (신고/모더레이션 이벤트)
-- 출처: docs/specs/06-community.md §3(안전장치 테이블), §5(App Store 1.2 필수)
-- (blocks 테이블은 0020_community_core.sql에서 먼저 만들었다 — posts/comments
-- RLS가 참조해서 순서상 그쪽이 먼저여야 했다.)
--
-- ⚠️ 0020_community_core.sql과 항상 같이 배포한다 — 기능과 모더레이션을
-- 분리 배포하면 안 된다는 스펙 원문 경고(§ 상단) 그대로.
-- ============================================================================

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'image')),
  target_id   uuid not null,
  reason      text not null check (reason in
                ('spam', 'harassment', 'hate', 'sexual', 'violence', 'illegal',
                 'misinformation', 'impersonation', 'other')),
  detail      text check (char_length(detail) <= 500),
  status      text not null default 'open'
              check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  resolved_at timestamptz,
  resolver_id uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index reports_status_created_idx on public.reports (status, created_at);

create table public.moderation_events (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id   uuid not null,
  action      text not null,
  source      text not null,
  score       numeric(4, 3),
  categories  jsonb,
  actor_id    uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index moderation_events_target_idx on public.moderation_events (target_type, target_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.reports enable row level security;
create policy "read own reports"
  on public.reports for select using (reporter_id = auth.uid());
create policy "admin read all reports"
  on public.reports for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "insert own reports"
  on public.reports for insert with check (reporter_id = auth.uid());
create policy "admin resolve reports"
  on public.reports for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
grant select, insert on public.reports to authenticated;
grant update on public.reports to authenticated;

alter table public.moderation_events enable row level security;
create policy "admin read moderation events"
  on public.moderation_events for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
grant select on public.moderation_events to authenticated;

revoke all on function public.bump_post_like_count() from public;
revoke all on function public.bump_post_comment_count() from public;
revoke all on function public.bump_destination_post_count() from public;

-- ── 신고 자동 숨김: 서로 다른 사용자 3명 이상 신고 시(§5.2) ─────────────────
-- security definer로 만든다 — 신고자가 대상 글의 작성자가 아니어도(대부분
-- 그렇다) posts/comments.status를 바꿀 수 있어야 하는데, 일반 트리거는
-- 신고자의 RLS 권한으로 실행돼 "본인 글만 수정 가능" 정책에 막히기 때문이다.
create or replace function public.check_report_threshold() returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  distinct_reporters int;
  was_published boolean := false;
begin
  select count(distinct reporter_id) into distinct_reporters
  from public.reports
  where target_type = new.target_type and target_id = new.target_id;

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
  end if;
  return new;
end;
$fn$;
revoke all on function public.check_report_threshold() from public;

create trigger reports_check_threshold
  after insert on public.reports
  for each row execute function public.check_report_threshold();
