-- ============================================================================
-- 0005: 경비 (정규화) — public.expenses
-- 출처: docs/specs/03-data-model.md §3.4
-- 전제: 0000이 기존(2.x, 미사용) public.expenses를 public.expenses_legacy_unused_v2로
-- 이름을 바꿔 두었으므로, 여기서 같은 이름을 새로 만들어도 충돌하지 않는다.
-- ============================================================================

create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  day_id       uuid references public.trip_days(id) on delete set null,
  item_id      uuid references public.itinerary_items(id) on delete set null,
  category     text not null check (category in
                 ('food','transport','lodging','shopping','activity','other')),
  description  text not null,
  amount       numeric(14,2) not null check (amount >= 0),
  currency     text not null,
  /** 입력 시점 환율 스냅샷. 나중에 환율이 변해도 기록은 고정된다 */
  fx_rate_to_base numeric(18,8),
  payment_method  text check (payment_method in ('cash','card','other')),
  paid_by      uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index if not exists expenses_trip_day_idx on public.expenses (trip_id, day_id);
