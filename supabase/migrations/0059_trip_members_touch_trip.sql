-- ============================================================================
-- 0059: 멤버 참여/나가기를 trips 행 변경으로 알린다
--
-- 0058에서 trip_members를 realtime에 올렸지만, 삭제 이벤트는 지워진 행으로 RLS를 확인할 수
-- 없어 구독한 모든 사람에게 기본키(trip_id, user_id)만 담겨 전달된다 — 남의 여행 멤버 변동까지
-- 새어 나간다. trip_members는 realtime에서 내리고, 대신 멤버(소유자 제외)가 들어오거나 나가면
-- 그 여행의 trips 행을 한 번 건드린다. trips 변경은 RLS대로 그 여행 사람들에게만 가고,
-- 클라이언트는 그 신호로 인원수를 다시 센다.
-- 소유자 행은 여행 생성 트리거가 넣으므로 건드리지 않는다(방금 만든 여행의 revision이 바로
-- 올라가 첫 저장이 충돌로 보이는 것을 막는다). 여행 삭제로 멤버가 연쇄 삭제될 땐 trips 행이
-- 이미 없어 아무 일도 안 일어난다.
-- ============================================================================

create or replace function public.touch_trip_on_member_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.trips set updated_at = now() where id = coalesce(new.trip_id, old.trip_id);
  return null;
end;
$fn$;
revoke all on function public.touch_trip_on_member_change() from public, anon, authenticated;

drop trigger if exists trip_members_touch_trip_insert on public.trip_members;
create trigger trip_members_touch_trip_insert
  after insert on public.trip_members
  for each row when (new.role <> 'owner')
  execute function public.touch_trip_on_member_change();

drop trigger if exists trip_members_touch_trip_delete on public.trip_members;
create trigger trip_members_touch_trip_delete
  after delete on public.trip_members
  for each row when (old.role <> 'owner')
  execute function public.touch_trip_on_member_change();

do $$
begin
  if exists (select 1 from pg_publication_tables
             where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_members') then
    alter publication supabase_realtime drop table public.trip_members;
  end if;
end $$;
