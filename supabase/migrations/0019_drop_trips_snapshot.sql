-- ============================================================================
-- 0019: ADR-002 M7 — trips.snapshot 컬럼 drop (불가역)
-- 출처: docs/specs/03-data-model.md §6.1 M7
--
-- Plan 탭(3.0)/레거시 둘 다 정규화 테이블(trip_days/itinerary_items/legs/
-- expenses)을 1차 데이터로 읽고 쓰도록 컷오버 완료(2026-09-21) —
-- src/shared/api/tripService.ts, src/services/supabaseService.js가 더 이상
-- 이 컬럼을 읽거나 쓰지 않음을 grep으로 확인 후 실행.
-- ============================================================================

alter table public.trips drop column snapshot;
