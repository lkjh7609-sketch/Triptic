-- ============================================================================
-- 0033: 동행 채팅방 — 매칭 확정된 그룹의 실시간 채팅
-- 별도 "채팅방"/"그룹" 테이블 없음 — 0032와 같은 철학으로 companion_posts.id를
-- 그대로 방 식별자로 쓴다(is_companion_member(post_id)로 멤버십 재사용).
-- 모더레이션은 AI 사전검열 없이 신고/차단만(사용자 결정) — 채팅은 저지연이
-- 중요하고, 대상이 이미 서로 신청/수락을 거친 소수 인원이라 공개 피드보다
-- 위험도가 낮다고 판단함.
-- ============================================================================

create table public.companion_messages (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.companion_posts(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 1000),
  status       text not null default 'published' check (status in ('published', 'hidden', 'removed')),
  report_count int not null default 0,
  created_at   timestamptz not null default now()
);
create index companion_messages_post_created_idx on public.companion_messages (post_id, created_at);

alter table public.companion_messages enable row level security;

create policy "read companion messages as member" on public.companion_messages for select
  using (public.is_companion_member(post_id) and status <> 'removed');

create policy "send companion messages as member" on public.companion_messages for insert
  with check (
    sender_id = (select auth.uid())
    and public.is_companion_member(post_id)
    and exists (select 1 from public.companion_posts p where p.id = post_id and p.status = 'matched')
  );

create policy "admin read all companion messages" on public.companion_messages for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));
create policy "admin update any companion message" on public.companion_messages for update
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

grant select, insert on public.companion_messages to authenticated;
-- 일반 사용자용 update 정책 없음 — 메시지는 수정/삭제 없이 신고 임계치로만 상태가 바뀐다.

-- 이 프로젝트 최초의 realtime 테이블 — 없으면 postgres_changes 구독에 이벤트가 안 온다.
alter publication supabase_realtime add table public.companion_messages;

-- ── 신고 파이프라인 확장(0032와 동일한 확장 방식) ──────────────────────────
alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'user', 'image', 'companion_post', 'companion_application', 'companion_message'));

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
  elsif new.target_type = 'companion_message' then
    update public.companion_messages set report_count = distinct_reporters where id = new.target_id;
    if distinct_reporters >= 3 then
      update public.companion_messages set status = 'hidden'
        where id = new.target_id and status = 'published'
        returning true into was_published;
      if was_published then
        insert into public.moderation_events (target_type, target_id, action, source)
        values ('companion_message', new.target_id, 'hidden', 'report_threshold');
      end if;
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function public.check_report_threshold() from public;
