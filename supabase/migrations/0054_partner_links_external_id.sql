-- ============================================================================
-- 0054: 제휴 링크에 제휴사 쪽 링크 ID
--
-- 마이리얼트립 마이링크는 (주소, 누른 위치)마다 따로 만들고, 예약·수익 내역은 그 링크 ID
-- (linkId = mylinkId)로 온다. 관리자 판매 탭이 linkId → 어디서 누른 링크(sub_id)인지
-- 되짚을 수 있게 저장한다. Travelpayouts 링크는 없음(null).
-- ============================================================================

alter table public.partner_links add column external_id text;

create index partner_links_brand_external_id_idx
  on public.partner_links (brand, external_id)
  where external_id is not null;
