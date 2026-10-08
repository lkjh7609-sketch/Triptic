-- 0102: 0101 초안에 있던 destination_seasons를 쓰지 않기로 해서 지운다(월별 기후는 앱에 포함한 정적 파일로 — seasonClimate.json).
drop table if exists public.destination_seasons;
