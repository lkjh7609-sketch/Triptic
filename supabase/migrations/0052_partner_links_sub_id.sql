-- ============================================================================
-- 0052: 제휴 링크 저장을 (원래 주소, sub_id) 단위로
--
-- 같은 Klook 검색 주소라도 여행 상세("trip_activity")와 액티비티 탭 검색창
-- ("activities_search")에서 누른 건 Travelpayouts 리포트에서 따로 보여야 한다.
-- 주소만으로 저장하면 먼저 만든 쪽 sub_id가 붙은 링크를 다른 곳에서도 재사용해
-- 집계가 섞인다.
-- ============================================================================

alter table public.partner_links add column sub_id text not null default 'trip_activity';
alter table public.partner_links drop constraint partner_links_pkey;
alter table public.partner_links add primary key (url, sub_id);
alter table public.partner_links alter column sub_id drop default;
