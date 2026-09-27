-- ============================================================================
-- 0037: 유료/무료 등급 기반 — 무료 사용자 여행 생성 2개 제한(평생 누적,
-- 삭제해도 안 돌려받음) + 일정 완료/재편집(완료 후에는 보기 전용, 재편집은
-- 무료 사용자 여행당 5회까지).
--
-- entitlements.ts의 can()은 클라이언트 전용이라 우회 가능하다 — 실제 경계는
-- 전부 여기(트리거/RPC/RLS)에 있다.
-- ============================================================================

-- ── 1) 등급 + 평생 생성 횟수 ─────────────────────────────────────────────
alter table public.profiles add column if not exists plan text not null default 'free' check (plan in ('free', 'pro'));
alter table public.profiles add column if not exists trips_created_count int not null default 0;

-- AFTER INSERT라 saveTrip()의 upsert(ON CONFLICT DO UPDATE, 기존 여행 수정)
-- 경로에서는 안 걸리고 진짜 새 행 삽입에만 걸린다 — BEFORE INSERT였다면
-- ON CONFLICT DO UPDATE도 걸려서 무료 한도에 걸린 사용자가 기존 여행조차
-- 못 고치게 될 뻔했다.
create or replace function public.enforce_trip_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_plan text;
  v_next_count int;
begin
  select plan, trips_created_count + 1 into v_plan, v_next_count
  from public.profiles where id = new.owner_id for update;

  if v_plan = 'free' and v_next_count > 2 then
    raise exception 'free plan trip limit reached' using errcode = 'P0001', hint = 'trip_limit_reached';
  end if;

  update public.profiles set trips_created_count = v_next_count where id = new.owner_id;
  return new;
end;
$fn$;

drop trigger if exists trips_quota_check on public.trips;
create trigger trips_quota_check
after insert on public.trips
for each row execute function public.enforce_trip_quota();

-- ── 2) 일정 완료(보기 전용 잠금) + 재편집(무료 여행당 5회) ──────────────
alter table public.trips add column if not exists finalized_at timestamptz;
alter table public.trips add column if not exists reopen_count int not null default 0;

create or replace function public.finalize_trip(p_trip_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  update public.trips set finalized_at = now()
  where id = p_trip_id and owner_id = (select auth.uid()) and finalized_at is null;
  if not found then
    raise exception 'trip not found, not yours, or already finalized';
  end if;
end;
$fn$;

create or replace function public.reopen_trip(p_trip_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_plan text;
  v_reopen_count int;
begin
  select p.plan, t.reopen_count into v_plan, v_reopen_count
  from public.trips t
  join public.profiles p on p.id = t.owner_id
  where t.id = p_trip_id and t.owner_id = (select auth.uid()) and t.finalized_at is not null
  for update of t;

  if not found then
    raise exception 'trip not found, not yours, or not finalized';
  end if;

  if v_plan = 'free' and v_reopen_count >= 5 then
    raise exception 'free plan reopen limit reached' using errcode = 'P0001', hint = 'reopen_limit_reached';
  end if;

  update public.trips set finalized_at = null, reopen_count = reopen_count + 1 where id = p_trip_id;
  return v_reopen_count + 1;
end;
$fn$;

revoke all on function public.finalize_trip(uuid) from public;
grant execute on function public.finalize_trip(uuid) to authenticated;
revoke all on function public.reopen_trip(uuid) from public;
grant execute on function public.reopen_trip(uuid) to authenticated;

-- 실제 잠금 — can_edit_trip은 itinerary_items RLS/replace_trip_itinerary가
-- 전부 통과하는 단일 지점이라 여기 하나만 고치면 어떤 경로로 쓰든 막힌다.
create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.deleted_at is null
      and t.finalized_at is null
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.trip_members m
                      where m.trip_id = t.id and m.user_id = auth.uid()
                        and m.role in ('owner','editor')))
  );
$fn$;

-- trips 행 자체(제목/날짜 등)도 완료 중엔 직접 upsert로 못 고치게 한다
-- (finalize_trip/reopen_trip은 SECURITY DEFINER라 이 RLS와 무관하게 동작).
drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips" on public.trips for update
  using (auth.uid() = owner_id and finalized_at is null);
