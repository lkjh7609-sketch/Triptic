-- ============================================================================
-- 0107: 0106 첫 버전에서 바꾼 것 정리(운영 DB는 2026-10-09에 이 상태로 맞췄다 — 새 DB에서는 아무 일도 하지 않는다)
--  · 붙여 쓴 이름 칸(name_key)과 그 trigram 색인 → 영어/한국어 이름을 따로 찾는 방식(0106)으로
--  · PGroonga 시험 색인·확장 제거(한국어 이름만 걸어도 약 140MB). 확장을 지워도 PGroonga 내부 파일 약 80MB가
--    DB 디렉터리에 남아 크기에 잡혔다. Groonga 내부 테이블을 table_remove로 지워 약 34MB는 줄였지만 약 50MB는 SQL로 못 지운다(Supabase 지원 문의)
-- ============================================================================

drop index if exists public.agoda_hotels_name_key_trgm;
drop index if exists public.agoda_hotels_name_key_pgroonga;
drop index if exists public.agoda_hotels_name_ko_pgroonga;
drop index if exists public.agoda_hotels_name_ko_grams;
alter table public.agoda_hotels drop column if exists name_ko_grams;
alter table public.agoda_hotels drop column if exists name_key;
drop extension if exists pgroonga;
