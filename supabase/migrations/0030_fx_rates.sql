-- ============================================================================
-- 0030: 시간별 환율 캐시 (02-screens.md §3.7 환율 자동 변환)
-- supabase/functions/fx-refresh가 매시 갱신한다(0031 크론). 통화별로 행을 두어
-- 일부 통화만 실패해도 나머지는 새 값으로, 실패한 통화는 직전 값 그대로 남는다.
-- 클라이언트는 읽기만 한다(src/features/plan/fxRates.ts).
-- ============================================================================

create table if not exists public.fx_rates (
  currency     text primary key check (currency ~ '^[A-Z]{3}$'),
  rate_per_usd numeric not null check (rate_per_usd > 0),  -- 1 USD당 해당 통화 금액
  source       text not null,
  fetched_at   timestamptz not null default now()
);

alter table public.fx_rates enable row level security;

drop policy if exists "fx rates are public" on public.fx_rates;
create policy "fx rates are public"
  on public.fx_rates for select
  using (true);

grant select on public.fx_rates to anon, authenticated;
