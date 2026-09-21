-- ============================================================================
-- 0016: get_user_travel_stats_snapshot() 폐기
--
-- 0014는 ADR-002 정규화 이관(M2~M4) 완료 전까지 trips.snapshot에서 즉석으로
-- 통계를 계산하던 임시 RPC였다. sync-trip-normalized Edge Function이 매
-- saveTrip() 성공 시마다 itinerary_items/trip_days/legs를 최신 상태로
-- 재동기화하므로(§6 M5), 스펙 원본 RPC인 get_user_travel_stats()(0009)를
-- 그대로 쓸 수 있게 됐다 — src/features/home/useHomeStats.ts도 함께 전환.
-- ============================================================================

drop function if exists public.get_user_travel_stats_snapshot();
