-- ============================================================================
-- 0070: 홈 시안(Stitch) 기능 — 여행기 저장(북마크)·일정 복사 허용, 동행 글의 원하는 동행·태그.
--
-- 1) posts.allow_copy — 작성자가 "내 일정 복사 허용"을 켠 글만 다른 사람이 일정을 복사할 수 있다.
--    새 글의 기본값은 허용 안 함. 이미 일정이 첨부돼 있던 글은 지금까지 복사가 됐으므로 허용으로 둔다(사용자 결정 2026-10-01).
--    ※ 일정은 글을 볼 수 있는 사람에게 읽기 전용으로 공개돼 있어(get_post_trip) 이 값은 "복사 버튼을 쓸 수 있는가"에 대한
--      작성자 동의 표시이고, 읽기 자체를 막는 장치는 아니다.
-- 2) companion_posts.pref_ages / pref_gender / tags — 원하는 나이대·성별(선택)과 태그(최대 3개, 고정 목록의 키).
--    값은 표시용이고 모집 자격을 막지 않는다. 작성자 컬럼 가드(guard_author_content_update)는 제목·본문 등만 잠그므로
--    작성자가 글을 올린 뒤 이 값들을 채울 수 있다(게시는 기존 moderate-content 함수 그대로).
-- 3) post_bookmarks — 여행기 저장. 본인 것만 읽고 쓰고 지운다. 저장 수는 get_post_bookmark_counts()로만 센다(목록은 공개 안 함).
--    profiles/posts가 지워지면 CASCADE로 함께 사라지므로 탈퇴(0065)·보관(0067)은 손대지 않는다.
-- 4) get_post_trip — 반환값에 allow_copy를 더한다.
-- ============================================================================

-- ── 1) 일정 복사 허용 ───────────────────────────────────────────────────────
alter table public.posts add column if not exists allow_copy boolean not null default false;
update public.posts set allow_copy = true where trip_id is not null and allow_copy = false;

-- ── 2) 동행 글: 원하는 동행·태그 ────────────────────────────────────────────
alter table public.companion_posts
  add column if not exists pref_ages text[] not null default '{}',
  add column if not exists pref_gender text not null default 'any',
  add column if not exists tags text[] not null default '{}';

alter table public.companion_posts drop constraint if exists companion_posts_pref_gender_check;
alter table public.companion_posts add constraint companion_posts_pref_gender_check
  check (pref_gender in ('any', 'female', 'male'));

alter table public.companion_posts drop constraint if exists companion_posts_pref_ages_check;
alter table public.companion_posts add constraint companion_posts_pref_ages_check
  check (pref_ages <@ array['10s', '20s', '30s', '40s', '50s', '60s']::text[] and cardinality(pref_ages) <= 6);

alter table public.companion_posts drop constraint if exists companion_posts_tags_check;
alter table public.companion_posts add constraint companion_posts_tags_check
  check (
    tags <@ array['photo', 'cafe', 'night', 'beer', 'localfood', 'healing', 'tour', 'shopping', 'activity', 'nature', 'culture', 'budget']::text[]
    and cardinality(tags) <= 3
  );

-- ── 3) 여행기 저장(북마크) ──────────────────────────────────────────────────
create table if not exists public.post_bookmarks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists post_bookmarks_post_idx on public.post_bookmarks (post_id);

alter table public.post_bookmarks enable row level security;
revoke all on public.post_bookmarks from public, anon, authenticated;
grant select, insert, delete on public.post_bookmarks to authenticated;

drop policy if exists "read own bookmarks" on public.post_bookmarks;
create policy "read own bookmarks" on public.post_bookmarks for select
  using (user_id = (select auth.uid()));

drop policy if exists "insert own bookmarks" on public.post_bookmarks;
create policy "insert own bookmarks" on public.post_bookmarks for insert
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.posts p where p.id = post_bookmarks.post_id and p.status = 'published' and p.deleted_at is null)
  );

drop policy if exists "delete own bookmarks" on public.post_bookmarks;
create policy "delete own bookmarks" on public.post_bookmarks for delete
  using (user_id = (select auth.uid()));

-- 글마다 저장한 사람 수 — 개별 저장 기록은 공개하지 않고 숫자만 돌려준다(공개된 글만)
create or replace function public.get_post_bookmark_counts(p_post_ids uuid[])
returns table (post_id uuid, bookmark_count int)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select b.post_id, count(*)::int
  from public.post_bookmarks b
  join public.posts p on p.id = b.post_id and p.status = 'published' and p.deleted_at is null
  where b.post_id = any (p_post_ids)
  group by b.post_id;
$fn$;
revoke all on function public.get_post_bookmark_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_post_bookmark_counts(uuid[]) to anon, authenticated;

-- ── 4) get_post_trip — allow_copy 포함 ──────────────────────────────────────
create or replace function public.get_post_trip(p_post_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_trip_id uuid;
  v_allow_copy boolean;
  result json;
begin
  select p.trip_id, p.allow_copy into v_trip_id, v_allow_copy
  from public.posts p
  where p.id = p_post_id and p.status = 'published';

  if v_trip_id is null then return null; end if;

  -- get_shared_trip과 동일한 최소 노출 원칙 — expenses/documents/bookings는 절대 포함하지 않는다.
  select json_build_object(
    'trip',  (select row_to_json(x) from (
                select id, title, city, city_lat, city_lng, start_date, end_date, total_days, base_currency
                from public.trips where id = v_trip_id) x),
    'days',  (select coalesce(json_agg(d order by d.day_index), '[]'::json)
                from public.trip_days d where d.trip_id = v_trip_id),
    'items', (select coalesce(json_agg(i order by i.position), '[]'::json)
                from public.itinerary_items i where i.trip_id = v_trip_id),
    'legs',  (select coalesce(json_agg(l), '[]'::json)
                from public.legs l where l.trip_id = v_trip_id),
    'allow_copy', v_allow_copy
  ) into result;

  return result;
end;
$fn$;

revoke all on function public.get_post_trip(uuid) from public, anon;
grant execute on function public.get_post_trip(uuid) to authenticated;
