-- ============================================================================
-- 0042: 건의하기(스크린샷 첨부) — 기존 "문의하기"(mailto) 대체용
--
-- 일반 사용자는 자기 글만 넣을 수 있고(insert-only), 조회/상태변경은 전부
-- admin_* SECURITY DEFINER RPC로만 가능하다(0038 admin_search_users와 같은
-- 패턴 — profiles에 "관리자는 전체 조회" RLS를 새로 추가하지 않고 RPC 내부
-- 자체 검사로 막는다).
-- ============================================================================

create table public.user_feedback (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  body           text not null check (char_length(body) between 1 and 2000),
  screenshot_path text,
  status         text not null default 'new' check (status in ('new', 'reviewed')),
  created_at     timestamptz not null default now()
);

create index user_feedback_created_idx on public.user_feedback (created_at desc);

alter table public.user_feedback enable row level security;

create policy "insert own feedback" on public.user_feedback for insert
  with check (user_id = (select auth.uid()));

-- INSERT ... RETURNING(클라이언트 라이브러리 대부분이 select()를 체이닝)은
-- SELECT 정책이 하나도 없으면 실패한다(시뮬레이션으로 확인) — 본인 글은
-- 볼 수 있게 한다. update 권한은 일반 사용자에게 아예 안 준다 — 관리자
-- 조회/처리는 admin_list_feedback()/admin_mark_feedback_reviewed()로만
-- 가능하다.
create policy "select own feedback" on public.user_feedback for select
  using (user_id = (select auth.uid()));

grant insert on public.user_feedback to authenticated;

create or replace function public.admin_list_feedback(p_offset int default 0, p_limit int default 20)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  handle text,
  body text,
  screenshot_path text,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select f.id, f.user_id, p.display_name, p.handle, f.body, f.screenshot_path, f.status, f.created_at
  from public.user_feedback f
  join public.profiles p on p.id = f.user_id
  where exists (select 1 from public.profiles admin_p where admin_p.id = auth.uid() and admin_p.role = 'admin')
  order by f.created_at desc
  limit p_limit offset p_offset;
$fn$;

revoke all on function public.admin_list_feedback(int, int) from public;
grant execute on function public.admin_list_feedback(int, int) to authenticated;

create or replace function public.admin_mark_feedback_reviewed(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  update public.user_feedback set status = 'reviewed' where id = p_id;
end;
$fn$;

revoke all on function public.admin_mark_feedback_reviewed(uuid) from public;
grant execute on function public.admin_mark_feedback_reviewed(uuid) to authenticated;

-- ── 스크린샷 저장용 비공개 버킷 — post-images(0020)와 같은 폴더 규칙
-- ({user_id}/{uuid}.webp)이라 본인 업로드만 허용하고, 조회는 관리자만
-- signed URL로 열어본다. ────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "insert own feedback screenshot" on storage.objects for insert
  with check (bucket_id = 'feedback-screenshots' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "admin read feedback screenshot" on storage.objects for select
  using (
    bucket_id = 'feedback-screenshots'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
