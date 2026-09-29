-- ============================================================================
-- 0056: 여행 동행자(trip_members) 실제로 채우기 + 멤버 접근 권한
--
-- 대시보드의 "N명"·함께하는 사람·홈 동행자 수가 늘 1명/0명이던 원인: trip_members에
-- 행이 하나도 없었다(소유자도 안 들어가고, 공유 링크는 읽기 전용 뷰어라 아무도 가입 안 함).
-- - 여행을 만들면 소유자를 role='owner'로 자동 추가(트리거) + 기존 여행 백필
-- - trips 조회: 예전엔 "공유 링크가 있는 여행은 누구나(비로그인 포함) 읽기" — 멤버가 아니어도
--   다 보였고, 링크를 끊으면 멤버도 못 봤다. 이제 소유자 또는 멤버(can_access_trip)만.
--   (공유 링크 미리보기는 get_shared_trip RPC가 SECURITY DEFINER라 이 정책과 무관)
-- - trips 수정: 소유자뿐 아니라 편집 멤버도(can_edit_trip — 완료 잠금 포함). 소유자 변경은 금지.
-- - 멤버는 스스로 나갈 수 있다(소유자 행은 제외).
-- - 여행 카드 요약(get_trip_summaries)·여행 통계(get_user_travel_stats)에 함께하는 여행 포함.
-- ============================================================================

-- ── 1) 소유자를 멤버로 ────────────────────────────────────────────────────────
create or replace function public.add_trip_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into public.trip_members (trip_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (trip_id, user_id) do update set role = 'owner';
  return new;
end;
$fn$;
revoke all on function public.add_trip_owner_member() from public, anon, authenticated;

drop trigger if exists trips_add_owner_member on public.trips;
create trigger trips_add_owner_member
  after insert on public.trips
  for each row execute function public.add_trip_owner_member();

insert into public.trip_members (trip_id, user_id, role)
select t.id, t.owner_id, 'owner'
from public.trips t
join public.profiles p on p.id = t.owner_id
on conflict (trip_id, user_id) do update set role = 'owner';

-- ── 2) trips 조회·수정 정책 ──────────────────────────────────────────────────
drop policy if exists "Users can view own or shared trips" on public.trips;
create policy "Users can view own or member trips" on public.trips for select
  using (owner_id = (select auth.uid()) or public.can_access_trip(id));

drop policy if exists "Users can update own trips" on public.trips;
create policy "Owners and editors can update trips" on public.trips for update
  using (public.can_edit_trip(id));

-- 소유자는 바꿀 수 없다 — 편집 멤버가 owner_id를 자기로 바꾸는 것을 막는다
create or replace function public.guard_protected_columns()
returns trigger
language plpgsql
as $fn$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if TG_TABLE_NAME = 'profiles' then
    if new.role is distinct from old.role then
      raise exception 'role can only be changed by admin_set_user_plan-style RPCs';
    end if;
    if new.plan is distinct from old.plan then
      raise exception 'plan can only be changed by admin_set_user_plan()';
    end if;
    if new.trips_created_count is distinct from old.trips_created_count then
      raise exception 'trips_created_count is server-managed';
    end if;
    if new.handle is distinct from old.handle then
      raise exception 'handle is server-managed';
    end if;
    if new.display_name is distinct from old.display_name then
      if new.display_name !~ '^[가-힣]{2,7}$' then
        raise exception 'display_name must be 2-7 Hangul characters' using errcode = 'P0001', hint = 'invalid_display_name';
      end if;
      if new.display_name in ('관리자', '운영자', '트립틱') then
        raise exception 'this display name is reserved' using errcode = 'P0001', hint = 'reserved_display_name';
      end if;
      if not public.is_display_name_available(new.display_name, new.id) then
        raise exception 'display_name already taken' using errcode = 'P0001', hint = 'duplicate_display_name';
      end if;
    end if;
  elsif TG_TABLE_NAME = 'trips' then
    if new.owner_id is distinct from old.owner_id then
      raise exception 'owner_id cannot be changed';
    end if;
    if new.reopen_count is distinct from old.reopen_count then
      raise exception 'reopen_count can only be changed by reopen_trip()';
    end if;
    if new.finalized_at is distinct from old.finalized_at then
      raise exception 'finalized_at can only be changed by finalize_trip()/reopen_trip()';
    end if;
    if new.forked_from_trip_id is distinct from old.forked_from_trip_id then
      raise exception 'forked_from_trip_id is server-managed';
    end if;
  end if;
  return new;
end;
$fn$;

-- ── 3) 멤버 스스로 나가기 ───────────────────────────────────────────────────
drop policy if exists "members can leave" on public.trip_members;
create policy "members can leave" on public.trip_members for delete
  using (user_id = (select auth.uid()) and role <> 'owner');

-- ── 4) 요약·통계에 함께하는 여행 포함 ────────────────────────────────────────
create or replace function public.get_trip_summaries()
returns table(trip_id uuid, planned_days integer, place_count integer, has_hotel boolean, has_flight boolean)
language sql
stable
as $fn$
  select
    t.id as trip_id,
    count(distinct i.day_id) filter (where i.type not in ('lodging', 'flight', 'note'))::int as planned_days,
    count(i.id) filter (where i.type not in ('lodging', 'flight', 'note'))::int as place_count,
    bool_or(i.type = 'lodging') as has_hotel,
    bool_or(i.type = 'flight') as has_flight
  from public.trips t
  left join public.itinerary_items i on i.trip_id = t.id
  where t.owner_id = auth.uid()
     or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid())
  group by t.id
$fn$;

create or replace function public.get_user_travel_stats()
returns json
language sql
stable
set search_path = public, pg_temp
as $fn$
  with my_trips as (
    select * from public.trips t
    where t.deleted_at is null
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
  ),
  done as (select * from my_trips where end_date < current_date),
  days as (
    select distinct d.date
    from public.trip_days d join done t on t.id = d.trip_id
  )
  select json_build_object(
    'tripCount',    (select count(*) from done),
    'countryCount', (select count(distinct i.country_code)
                       from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.country_code is not null),
    'cityCount',    (select count(distinct d.city_name)
                       from public.trip_days d join done t on t.id = d.trip_id
                      where d.city_name is not null),
    'dayCount',     (select count(*) from days),
    'placeCount',   (select count(*) from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.type in ('place','meal','activity')),
    'groundMeters', (select coalesce(sum(l.distance_m), 0)
                       from public.legs l join done t on t.id = l.trip_id
                      where l.mode <> 'flight'),
    'countries',    (select coalesce(json_agg(distinct i.country_code), '[]'::json)
                       from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.country_code is not null)
  );
$fn$;
