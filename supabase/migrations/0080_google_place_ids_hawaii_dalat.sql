-- ============================================================================
-- 0080: 'Google 연동' 화면에서 자동으로 못 잡은 2곳을 사용자가 보내 준 구글 지도 링크로 연결.
--  · 하와이 — https://maps.app.goo.gl/ha8RWnsKK252JisU9 (구글 지도 '미국 하와이 호놀룰루', 핀 21.3098845, -157.8581401)
--  · 달랏  — https://maps.app.goo.gl/L2ZSnueJR5ogDj5w6 (달랏은 구글 지도에 도시 항목이 없어 중심가인 '달랏 야시장'으로 지정,
--            핀 11.9414015, 108.4372912 → 달랏 일정을 만들면 지도가 이쪽으로 열리도록 여행지 좌표도 같이 옮긴다)
--  · 장소 ID는 링크의 지도 기능 ID(0x…:0x…)를 장소 ID(ChIJ…)로 바꾼 값이다(알려진 장소 ID로 변환 방식을 검증함). 구글이 그 ID로 못 찾으면
--    앱이 이름 검색으로 대신한다(CreateTripModal).
-- ============================================================================

update public.destinations
set google_place_id = 'ChIJTUbDjDsYAHwRbJen81_1KEs', lat = 21.3098845, lng = -157.8581401
where slug = 'hawaii';

update public.destinations
set google_place_id = 'ChIJw-dBTv8TcTERPCSnIa35zyE', lat = 11.9414015, lng = 108.4372912
where slug = 'dalat';
