-- ============================================================================
-- 0002: 예약 · 문서 (바우처) — documents, bookings
-- 출처: docs/specs/03-data-model.md §3.3
-- 생성 순서 근거: §3.3.1 "profiles → trips → trip_members → trip_days →
--   documents → bookings → itinerary_items → (alter) → legs → expenses"
-- ============================================================================

create table if not exists public.documents (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid references public.trips(id) on delete cascade,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  storage_path   text not null,            -- Storage 'vouchers' 비공개 버킷 경로
  original_name  text not null,
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes <= 20 * 1024 * 1024),
  page_count     int,
  parse_status   text not null default 'pending'
                 check (parse_status in ('pending','processing','parsed','failed','skipped')),
  parse_error    text,
  -- 개인정보: 원문 텍스트는 절대 저장하지 않는다. 마스킹 결과의 해시만 남겨 중복 업로드를 감지한다.
  content_hash   text,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create unique index if not exists documents_owner_content_hash_key
  on public.documents (owner_id, content_hash) where content_hash is not null and deleted_at is null;

create table if not exists public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  document_id        uuid references public.documents(id) on delete set null,
  type               text not null check (type in
                       ('flight','lodging','rail','car_rental','activity','restaurant','insurance','other')),
  provider           text,                  -- 'Korean Air', 'Agoda' 등
  reference_code     text,                  -- PNR / 예약번호
  /** 파싱된 구조화 데이터. 타입별 스키마는 04-document-ai.md */
  parsed             jsonb not null default '{}'::jsonb,
  /** 필드별 신뢰도 0~1 */
  confidence         jsonb not null default '{}'::jsonb,
  /** 사용자가 검수 시트에서 확정했는가 — false면 일정에 반영하지 않는다 */
  confirmed_by_user  boolean not null default false,
  parser_version     text,                  -- 재파싱 필요 여부 판단용
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists bookings_trip_type_idx on public.bookings (trip_id, type);
