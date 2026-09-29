-- ============================================================================
-- 0058: 여행 실시간 동시 편집
--
-- 저장은 여행 전체 스냅샷을 통째로 바꾸는 방식(trips 행 수정 → trip-itinerary-write가
-- replace_trip_itinerary로 일정 전체 교체)이라, 두 사람이 같은 순간에 고치면 늦게 저장한
-- 쪽이 먼저 저장한 쪽 변경을 모르고 덮어쓴다. 그래서
-- - trips.revision: 행이 바뀔 때마다 1씩 오른다(트리거). 클라이언트는 자기가 본 revision일
--   때만 저장하고(.eq('revision', n)), 0행이면 "다른 사람이 먼저 바꿨다"로 보고 새로 불러온다.
-- - trips.updated_by: 마지막으로 고친 사람(참고용).
-- - trips·trip_members를 realtime에 올린다 — 여행 화면은 trips 행 변경을 받아 일정을 다시
--   읽고, 대시보드는 멤버 변경을 받아 인원수를 다시 센다. 전달은 RLS(can_access_trip)를 따른다.
-- ============================================================================

alter table public.trips add column if not exists revision integer not null default 0;
alter table public.trips add column if not exists updated_by uuid;

create or replace function public.bump_trip_revision()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  new.revision := old.revision + 1;
  new.updated_by := auth.uid();
  return new;
end;
$fn$;
revoke all on function public.bump_trip_revision() from public, anon, authenticated;

drop trigger if exists trips_bump_revision on public.trips;
create trigger trips_bump_revision
  before update on public.trips
  for each row execute function public.bump_trip_revision();

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips') then
    alter publication supabase_realtime add table public.trips;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_members') then
    alter publication supabase_realtime add table public.trip_members;
  end if;
end $$;
