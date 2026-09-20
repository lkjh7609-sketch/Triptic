-- ============================================================================
-- 0007: RLS 정책 — 정규화 테이블 전체
-- 출처: docs/specs/03-data-model.md §4.1, §4.2, §4.3
-- 원칙: "모든 테이블에 RLS를 켠다. 예외 없음. 정책 없는 테이블은 배포 금지." (§1)
-- ============================================================================

-- ── §4.1 헬퍼 함수 ──────────────────────────────────────────────────────────
create or replace function public.can_access_trip(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.deleted_at is null
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.trip_members m
                      where m.trip_id = t.id and m.user_id = auth.uid()))
  );
$fn$;

create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.deleted_at is null
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.trip_members m
                      where m.trip_id = t.id and m.user_id = auth.uid()
                        and m.role in ('owner','editor')))
  );
$fn$;

-- ── §4.2 표준 패턴: itinerary_items, trip_days, legs, bookings, expenses ────
create or replace function public._apply_trip_scoped_rls(p_table text) returns void
language plpgsql as $fn$
begin
  execute format('alter table public.%I enable row level security', p_table);

  execute format($p$
    drop policy if exists "read of accessible trips" on public.%1$I;
    create policy "read of accessible trips" on public.%1$I for select
      using (public.can_access_trip(trip_id));

    drop policy if exists "insert into editable trips" on public.%1$I;
    create policy "insert into editable trips" on public.%1$I for insert
      with check (public.can_edit_trip(trip_id));

    drop policy if exists "update of editable trips" on public.%1$I;
    create policy "update of editable trips" on public.%1$I for update
      using (public.can_edit_trip(trip_id));

    drop policy if exists "delete of editable trips" on public.%1$I;
    create policy "delete of editable trips" on public.%1$I for delete
      using (public.can_edit_trip(trip_id));
  $p$, p_table);
end;
$fn$;

select public._apply_trip_scoped_rls('itinerary_items');
select public._apply_trip_scoped_rls('trip_days');
select public._apply_trip_scoped_rls('legs');
select public._apply_trip_scoped_rls('bookings');
select public._apply_trip_scoped_rls('expenses');

drop function public._apply_trip_scoped_rls(text);

-- ── trip_members (스펙 §4.2 표준 패턴 외 — 멤버십 관리는 소유자 전용) ────────
-- 스펙 §4에 trip_members의 명시적 정책 예시는 없다. "RLS 예외 없음" 원칙(§1)에
-- 따라, can_access_trip으로 조회를, 소유자만 멤버 추가/변경/삭제하도록 최소
-- 권한으로 구성한다 (근거: 다른 협업 도구의 통상적 멤버십 관리 관행).
alter table public.trip_members enable row level security;

drop policy if exists "read members of accessible trips" on public.trip_members;
create policy "read members of accessible trips" on public.trip_members for select
  using (public.can_access_trip(trip_id));

drop policy if exists "owner manages members" on public.trip_members;
create policy "owner manages members" on public.trip_members for all
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

-- ── §4.3 documents — 더 엄격하게 (바우처에는 여권번호 등이 들어 있다) ────────
alter table public.documents enable row level security;

drop policy if exists "owner only" on public.documents;
create policy "owner only" on public.documents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── §3.5 weather_cache / climate_normals — 공유 참조 데이터 ─────────────────
-- 스펙에 명시적 정책은 없으나 "RLS 예외 없음" 원칙에 따라 켠다. 민감정보가 아닌
-- 공유 캐시이므로 읽기는 전체 허용하고, 쓰기는 서버(service_role, RLS 우회)만
-- 수행한다 — usage_events(0009)와 동일한 "서버만 기록" 원칙.
alter table public.weather_cache enable row level security;
drop policy if exists "public read weather cache" on public.weather_cache;
create policy "public read weather cache" on public.weather_cache for select using (true);

alter table public.climate_normals enable row level security;
drop policy if exists "public read climate normals" on public.climate_normals;
create policy "public read climate normals" on public.climate_normals for select using (true);

-- ── §4.3 Storage 버킷 정책 (vouchers, public = false) ───────────────────────
-- 버킷 자체 생성은 Dashboard 또는 `supabase storage buckets create vouchers --no-public`로
-- 수행한다 (SQL만으로는 버킷을 만들 수 없다). 아래는 정책만 정의한다.
drop policy if exists "voucher read own" on storage.objects;
create policy "voucher read own"
  on storage.objects for select
  using (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "voucher write own" on storage.objects;
create policy "voucher write own"
  on storage.objects for insert
  with check (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);
-- 경로 규칙: vouchers/{user_id}/{trip_id}/{document_id}.{ext}
-- 클라이언트는 항상 서명 URL(유효기간 5분)로만 접근한다.
