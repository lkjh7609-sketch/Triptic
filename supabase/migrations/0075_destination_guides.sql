-- ============================================================================
-- 0075: 도시 채널 화면용 — 도시별 안내 내용 테이블 + 팔로워 수 조회 함수.
-- · destination_guides: 대표 명소·추천 기간·최적 시기·물가 예시(한국어·영어). 읽기 전용(공개),
--   쓰기 정책 없음 → 관리자가 SQL/마이그레이션으로만 채운다. 내용은 별도 마이그레이션(승인 후).
-- · destination_follower_count: destination_follows는 RLS로 본인 행만 읽혀 개수를 셀 수 없어서,
--   개수만 돌려주는 security definer 함수를 둔다(누가 팔로우했는지는 노출되지 않음).
-- ============================================================================

create table public.destination_guides (
  destination_id uuid primary key references public.destinations(id) on delete cascade,
  -- [{ "ko": "...", "en": "..." } × 6]
  landmarks      jsonb not null default '[]'::jsonb,
  -- { "ko": "3박 4일", "en": "3 nights" }
  trip_length    jsonb,
  -- { "ko": "5월~9월(건기)", "en": "May–Sep (dry season)" }
  best_season    jsonb,
  -- [{ "key": "coffee"|"taxi"|"meal", "label"?: {ko,en}, "min": number, "max": number|null }] — 현지 통화 기준
  prices         jsonb not null default '[]'::jsonb,
  updated_at     timestamptz not null default now()
);

alter table public.destination_guides enable row level security;
create policy "public read destination guides" on public.destination_guides
  for select using (true);
grant select on public.destination_guides to anon, authenticated;

create or replace function public.destination_follower_count(p_destination_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.destination_follows where destination_id = p_destination_id;
$$;

revoke all on function public.destination_follower_count(uuid) from public;
grant execute on function public.destination_follower_count(uuid) to anon, authenticated;
