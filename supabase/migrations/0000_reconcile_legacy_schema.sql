-- ============================================================================
-- 0000: 기존(2.x) 스키마 정합화 — 정규화 마이그레이션의 전제 조건
-- ============================================================================
-- ⚠️ 이 파일은 03-data-model.md에 문자 그대로 적혀 있지 않다. 스펙은 "정규화
-- 테이블을 새로 만든다"는 목표 상태(target state)만 기술하고, 실제 운영 중인
-- supabase/schema.sql과의 이름 충돌은 다루지 않는다. 아래는 실측한 운영 스키마와
-- 목표 스키마를 대조해 발견한 충돌이며, 03-data-model.md §1 원칙("기존 설계 철학을
-- 그대로 계승")에 따라 데이터 손실 없이 target 상태로 옮기는 방법을 기록한다.
-- (DEVELOPMENT_PLAN.md: "스펙에 없는 판단이 필요하면 결정과 근거를 남긴다")
--
-- 실측 충돌 (2026-09-20, Supabase MCP로 운영 프로젝트 직접 조회):
--   1) public.user_profiles (id, guest_name, backup_code, created_at, updated_at)
--      → 목표: public.profiles. PK 구조(auth.users(id) FK)는 동일하다.
--      ⚠️ backup_code는 schema.sql에 없는 컬럼이다(스키마 드리프트로 확인됨,
--      Firebase 시절 "기기 백업 코드" 기능 잔재로 추정). 사용처가 확인되지 않으므로
--      드롭하지 않고 rename된 테이블에 그대로 보존한다.
--   2) public.trips (user_id, name, city, city_lat, city_lng, total_days, currency,
--      share_id, is_shared, snapshot)
--      → 목표 컬럼명: owner_id, title, base_currency, status, cover_url, deleted_at 추가.
--         city/city_lat/city_lng/total_days는 목표 스키마에 없다(정보가 trip_days로
--         이동) — 이번 파일에서는 "보존"만 하고 드롭하지 않는다.
--         ⚠️ share_id/is_shared도 schema.sql에 없는 컬럼이다(드리프트). 코드베이스
--         전체 grep 결과 참조하는 곳이 없고 실제 공유는 shared_trips 테이블로 이뤄지고
--         있어 죽은 컬럼으로 추정되나, 다른 곳(별도 리포·Edge Function 등)에서 쓸 수도
--         있으므로 드롭하지 않고 보존한다.
--   3) public.expenses (trip_id, day INTEGER, item_name, amount, category, payment_method)
--      ⚠️ **이름이 완전히 같고 구조는 호환되지 않는다.** schema.sql 자체 주석이
--      "현재 애플리케이션 코드는 미사용"이라고 명시한 예약 테이블이다. 목표 스키마의
--      새 public.expenses(day_id, item_id, description, currency, fx_rate_to_base, paid_by …)
--      와 이름이 충돌하므로, 이 파일은 기존 테이블을 손실 없이 old_expenses_v2로
--      이름만 바꿔 보존한다. 0005_expenses.sql이 새 이름으로 정규화 테이블을 만든다.
--   4) public.handle_new_user() — schema.sql에 없는 함수(드리프트로 확인됨).
--      auth.users insert 트리거로 public.user_profiles(id, guest_name)에 행을 만든다.
--      **rename 후에도 계속 동작하려면 함수 본문의 테이블명을 profiles로 고쳐야
--      한다** — Postgres는 테이블 rename 시 FK는 자동 추적하지만 함수 본문 안의
--      리터럴 SQL 텍스트는 고치지 않는다. 고치지 않으면 이후 모든 신규 가입이
--      즉시 실패한다. 이 파일 §5에서 재정의한다.
--   5) public.migrate_from_localstorage(uuid, json) — schema.sql에 없는 함수
--      (드리프트로 확인됨). schema.sql 자체 주석이 "Firebase 기반 기기 백업 코드
--      기능... 완전히 대체되었다. 기존 데이터가 없다면 직접 확인 후 DROP해도 된다"고
--      명시한 바로 그 함수다. 코드베이스 전체 grep + 실제 호출 이력(0건) 확인 완료 →
--      이 파일 §6에서 DROP한다. (rename 후 컬럼명이 바뀌면 이 함수도 어차피 깨진다.)
--   6) public.backup_mappings — 위와 동일한 Firebase 잔재 테이블. schema.sql 주석이
--      "기존 데이터가 없다면 DROP해도 된다"고 명시. 행 수 0건 확인 완료 → §6에서 DROP.
--
-- public.places / public.hotels / public.flights 는 목표 스키마의 신규 테이블명
-- (itinerary_items / bookings / legs)과 겹치지 않으므로 이 파일에서 건드리지 않는다.
--
-- 🔒 실행 절차 (docs/DEVELOPMENT_PLAN.md R8, 03-data-model.md §6 M0):
--   실측 결과 trips/places/hotels/flights/expenses/shared_trips/suggestions/
--   backup_mappings 전부 0행, user_profiles만 3행 — 사실상 출시 전 상태라
--   스냅샷 데이터 유실 위험은 낮다. 그러나 **rename은 데이터가 아니라 현재
--   배포된 legacy 앱의 동작 자체를 깰 수 있다** (legacy/index.html의
--   user_profiles.upsert, src/services/supabaseService.js의 trips 컬럼 접근).
--   그래서 이 마이그레이션은 반드시 아래 두 패치와 **같은 배포 사이클**로
--   적용한다 (하나만 먼저 나가면 그 사이 실사용자 요청이 깨진다):
--     - src/services/supabaseService.js  (trips 컬럼명 갱신)
--     - legacy/index.html                (user_profiles → profiles)
-- ============================================================================

-- ── 1) user_profiles → profiles ────────────────────────────────────────────
alter table if exists public.user_profiles rename to profiles;

alter table public.profiles
  add column if not exists handle        text,
  add column if not exists display_name  text not null default '',
  add column if not exists avatar_url    text,
  add column if not exists bio           text,
  add column if not exists locale        text not null default 'ko',
  add column if not exists temp_unit     text not null default 'c',
  add column if not exists distance_unit text not null default 'km',
  add column if not exists base_currency text not null default 'KRW',
  add column if not exists home_country  char(2),
  add column if not exists stats_public  boolean not null default true,
  add column if not exists deletion_requested_at timestamptz;

-- guest_name(2.x 비로그인 표시명)은 display_name으로 이관 후 보존(드롭 안 함).
update public.profiles set display_name = coalesce(nullif(display_name, ''), guest_name, '')
where display_name = '' and guest_name is not null;

alter table public.profiles
  add constraint profiles_handle_check check (handle is null or handle ~ '^[a-z0-9_]{3,20}$'),
  add constraint profiles_locale_check check (locale in ('ko','en','zh-CN')),
  add constraint profiles_temp_unit_check check (temp_unit in ('c','f')),
  add constraint profiles_distance_unit_check check (distance_unit in ('km','mi')),
  add constraint profiles_bio_check check (bio is null or char_length(bio) <= 200);

create unique index if not exists profiles_handle_key on public.profiles (handle) where handle is not null;

-- ── 2) trips 컬럼 정합화 ────────────────────────────────────────────────────
alter table public.trips rename column user_id to owner_id;
alter table public.trips rename column name to title;
alter table public.trips rename column currency to base_currency;

alter table public.trips
  add column if not exists status text not null default 'planning',
  add column if not exists cover_url text,
  add column if not exists deleted_at timestamptz;

alter table public.trips
  add constraint trips_status_check check (status in ('planning','ongoing','completed','archived')),
  add constraint trips_title_check check (char_length(title) between 1 and 100),
  add constraint trips_date_check check (end_date >= start_date);

-- city/city_lat/city_lng/total_days는 trip_days(0001)로 대체될 예정이나, 이관
-- 검증(§6 M3) 전까지 드롭하지 않는다. 참고용으로 주석만 남긴다.
comment on column public.trips.city is '⚠️ 2.x 잔존 컬럼. trip_days.city_name으로 대체 예정 (이관 검증 후 제거)';
comment on column public.trips.total_days is '⚠️ 2.x 잔존 컬럼. end_date - start_date + 1로 파생 계산 가능 (이관 검증 후 제거)';

-- FK가 profiles를 가리키도록 갱신 (테이블명 변경에 따른 자동 추적 — Postgres는
-- rename 시 기존 FK 제약을 자동으로 유지하므로 별도 작업 불필요. 아래는 방어적 확인용.)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'trips_owner_id_fkey' and table_name = 'trips'
  ) then
    alter table public.trips
      add constraint trips_owner_id_fkey foreign key (owner_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

-- ── 3) expenses 이름 충돌 회피 (데이터 보존, 드롭하지 않음) ─────────────────
alter table if exists public.expenses rename to expenses_legacy_unused_v2;
comment on table public.expenses_legacy_unused_v2 is
  '2.x 예약 테이블(미사용 확인됨, schema.sql 원 주석 참고). 0005_expenses.sql이 새 정규화 expenses를 만들기 전 이름 충돌 회피용으로 보존. 사용 이력이 없음이 재확인되면 별도 승인 후 DROP한다.';

-- ── 4) 트리거 재부착 (rename으로 트리거명이 테이블을 따라가지 않는 것을 방지) ──
drop trigger if exists update_user_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function update_updated_at_column();

-- ── 5) handle_new_user() — profiles를 가리키도록 재정의 (신규 가입 트리거) ───
-- 원래 정의(운영에서 직접 조회):
--   INSERT INTO public.user_profiles (id, guest_name) VALUES (new.id, COALESCE(...));
-- search_path를 고정하지 않은 상태였다 (get_advisors 보안 권고 함께 해소).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_name text := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
begin
  insert into public.profiles (id, guest_name, display_name)
  values (new.id, v_name, v_name)
  on conflict (id) do nothing;
  return new;
end;
$fn$;

-- ── 6) Firebase 시절 잔재 정리 (schema.sql 원 주석이 권고, 사용 이력 0건 확인됨) ──
drop function if exists public.migrate_from_localstorage(uuid, json);
drop table if exists public.backup_mappings;
