-- ============================================================================
-- 0051: 제휴(Travelpayouts) 링크 변환 결과 저장
--
-- 여행 상세의 "도시 투어·액티비티 찾아보기"는 도시별 Klook 검색 주소를 Travelpayouts
-- 링크 변환 API(분당 100회 제한)로 제휴 링크로 바꾼다. 같은 주소는 한 번만 변환하고
-- 여기 저장해 재사용한다. 서버(service_role, /api/partnerLink)만 읽고 쓴다.
-- ============================================================================

create table public.partner_links (
  url         text primary key,      -- 원래 브랜드 주소(예: klook.com/ko/search/result/?query=Osaka)
  brand       text not null,
  partner_url text not null,         -- 변환된 제휴 링크(klook.tp.st/...)
  created_at  timestamptz not null default now()
);

alter table public.partner_links enable row level security;
revoke all on public.partner_links from anon, authenticated;
