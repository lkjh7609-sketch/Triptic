-- ============================================================================
-- 0010: 사용량 계측 — usage_events
-- 출처: docs/specs/03-data-model.md §9
-- 3.0에 과금은 없지만 계측은 넣는다 — 나중에 가격을 정할 근거이자, 지금 당장은
-- 남용 방어의 기준이 된다 (DEVELOPMENT_PLAN.md §13.3).
-- ============================================================================

create table if not exists public.usage_events (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- 'document.parse' | 'trip.create' | 'ai.recommend' | 'directions.fetch'
  -- | 'voucher.upload' | 'weather.fetch' | 'limit.reached'
  kind       text not null,
  -- 비용 환산용 수량 (파싱 페이지 수, 업로드 바이트 등). 단순 카운트면 1
  quantity   numeric(12,2) not null default 1,
  -- 과금 단위 후보를 미리 붙여 둔다 (여행별 청구 모델 검토용)
  trip_id    uuid references public.trips(id) on delete set null,
  -- ⚠️ 개인정보·문서 내용을 절대 넣지 않는다. 식별 불가능한 메타데이터만.
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_user_kind_created_idx
  on public.usage_events (user_id, kind, created_at desc);
create index if not exists usage_events_created_at_idx on public.usage_events (created_at);
create index if not exists usage_events_trip_id_idx on public.usage_events (trip_id) where trip_id is not null;

alter table public.usage_events enable row level security;

-- 사용자는 자기 사용량만 읽을 수 있다 (설정 화면에서 "이번 달 사용량" 표시용)
drop policy if exists "read own usage" on public.usage_events;
create policy "read own usage" on public.usage_events
  for select using (user_id = auth.uid());

-- 쓰기는 서버(Edge Function / service_role)만. 클라이언트가 직접 기록하면
-- 한도를 우회할 수 있다.
revoke insert, update, delete on public.usage_events from authenticated, anon;

-- ── §9.1 한도 확인 함수 ──────────────────────────────────────────────────
-- 최근 24시간 사용량. 남용 방어 한도 판정에 쓴다.
create or replace function public.usage_in_window(
  p_user_id uuid, p_kind text, p_window interval)
returns numeric
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(sum(quantity), 0)
  from public.usage_events
  where user_id = p_user_id
    and kind = p_kind
    and created_at > now() - p_window;
$fn$;
