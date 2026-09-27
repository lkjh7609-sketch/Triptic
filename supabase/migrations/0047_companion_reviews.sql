-- ============================================================================
-- 0047: 동행 일정 종료 후 체크인("잘 마무리됐나요?") + 동행 별점(1~5)
--
-- 일정이 closed(0046 — 주최자 완료 또는 종료일 경과 자동 완료)가 되면 각
-- 멤버(주최자 + 수락된 지원자)가 한 번만
--   - 일정이 잘 마무리됐는지(went_well)
--   - 나머지 멤버 각각에 대한 별점
-- 을 함께 제출한다. 체크인 행이 "후기 완료" 표시라서, 일부 멤버만 평가하고
-- 끝내면 나머지는 영영 못 남긴다 — 그래서 나머지 멤버 전원을 정확히 한 번씩
-- 평가해야만 받는다.
--
-- 개별 별점은 남긴 사람만 볼 수 있고(평가받은 사람도 누가 몇 점 줬는지 못
-- 봄), 공개되는 건 community_profiles 뷰의 평균/개수뿐이다. 뷰는 소유자
-- 권한으로 돌아서 RLS와 무관하게 집계된다(0041에서 profiles를 그렇게 읽는
-- 것과 같음).
-- ============================================================================

create table public.companion_trip_checkins (
  post_id    uuid not null references public.companion_posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  went_well  boolean not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.companion_reviews (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.companion_posts(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  created_at  timestamptz not null default now(),
  unique (post_id, reviewer_id, reviewee_id),
  check (reviewer_id <> reviewee_id)
);
create index companion_reviews_reviewee_idx on public.companion_reviews (reviewee_id);

alter table public.companion_trip_checkins enable row level security;
alter table public.companion_reviews enable row level security;

create policy "read own companion checkins" on public.companion_trip_checkins for select
  using (user_id = (select auth.uid()));
create policy "admin read all companion checkins" on public.companion_trip_checkins for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

create policy "read companion reviews I wrote" on public.companion_reviews for select
  using (reviewer_id = (select auth.uid()));
create policy "admin read all companion reviews" on public.companion_reviews for select
  using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'));

-- 쓰기는 아래 RPC로만
revoke all on public.companion_trip_checkins from anon, authenticated;
revoke all on public.companion_reviews from anon, authenticated;
grant select on public.companion_trip_checkins to authenticated;
grant select on public.companion_reviews to authenticated;

-- p_ratings: [{"user_id": "<uuid>", "rating": 1..5}, ...]
create or replace function public.submit_companion_review(p_post_id uuid, p_went_well boolean, p_ratings jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_post record;
  v_members uuid[];
  v_others uuid[];
  v_given uuid[];
begin
  if v_uid is null then raise exception 'login required' using errcode = '42501'; end if;
  if p_went_well is null then raise exception 'went_well is required'; end if;
  if p_ratings is null or jsonb_typeof(p_ratings) <> 'array' then raise exception 'ratings must be an array'; end if;

  select * into v_post from public.companion_posts where id = p_post_id;
  if v_post is null or v_post.status <> 'closed' then raise exception 'trip is not completed yet'; end if;

  v_members := array(
    select v_post.author_id
    union
    select a.applicant_id from public.companion_applications a where a.post_id = p_post_id and a.status = 'accepted'
  );
  if not (v_uid = any(v_members)) then raise exception 'only trip members can review' using errcode = '42501'; end if;

  v_others := array(select m from unnest(v_members) m where m <> v_uid order by m);
  v_given := array(select (e->>'user_id')::uuid from jsonb_array_elements(p_ratings) e order by 1);
  if v_given <> v_others then raise exception 'ratings must cover every other member exactly once'; end if;

  insert into public.companion_trip_checkins (post_id, user_id, went_well) values (p_post_id, v_uid, p_went_well);
  insert into public.companion_reviews (post_id, reviewer_id, reviewee_id, rating)
    select p_post_id, v_uid, (e->>'user_id')::uuid, (e->>'rating')::smallint
    from jsonb_array_elements(p_ratings) e;
exception
  when unique_violation then raise exception 'you already reviewed this trip';
end;
$fn$;
revoke all on function public.submit_companion_review(uuid, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.submit_companion_review(uuid, boolean, jsonb) to authenticated;

-- 닉네임 옆 별점 — 기존 컬럼 순서 그대로 두고 끝에만 붙인다(grant 유지)
create or replace view public.community_profiles as
  select
    id,
    display_name,
    avatar_url,
    bio,
    role = 'admin' as is_admin,
    (select round(avg(r.rating)::numeric, 1) from public.companion_reviews r where r.reviewee_id = profiles.id) as rating_avg,
    (select count(*)::int from public.companion_reviews r where r.reviewee_id = profiles.id) as rating_count
  from public.profiles;
