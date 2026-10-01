-- ============================================================================
-- 0074: 도시 대표 사진 주소 채우기 — destinations.cover_url.
-- · 78곳: 새로 만든 사진(Storage destination-covers/슬러그.webp, 0073 버킷, 1024x768 WebP)
-- · 22곳(서울·도쿄·오사카·후쿠오카·교토·타이페이·다낭·발리·세부·시드니·파리·로마·프라하·마드리드·암스테르담·빈·부다페스트·베네치아·뉴욕·하와이·샌프란시스코·두바이):
--   앱 코드(useCityImage)에 있던 검증된 Unsplash 사진 주소 그대로
-- 이미 값이 있는 도시는 건드리지 않는다(나중에 직접 바꾼 사진 보호).
-- ============================================================================

update public.destinations d
set cover_url = 'https://ifzykfemjzqquyzgpqax.supabase.co/storage/v1/object/public/destination-covers/' || d.slug || '.webp'
where d.slug in ('abudhabi','athens','auckland','bangkok','barcelona','beijing','beppu','berlin','boracay','brisbane','brussels','buenosaires','busan','cairo','cancun','capetown','chiangmai','copenhagen','cusco','delhi','doha','dublin','dubrovnik','fiji','florence','gangneung','guam','gyeongju','hanoi','havana','hochiminh','hongkong','istanbul','jaipur','jeju','jeonju','kaohsiung','kathmandu','kualalumpur','lasvegas','lima','lisbon','london','losangeles','macau','male','marrakech','melbourne','mexicocity','miami','milan','mumbai','munich','nagoya','nairobi','nhatrang','okinawa','phuket','queenstown','riodejaneiro','saipan','santiago','santorini','saopaulo','sapporo','shanghai','siemreap','singapore','sokcho','stockholm','telaviv','toronto','ulaanbaatar','vancouver','warsaw','yeosu','zanzibar','zurich')
  and (d.cover_url is null or btrim(d.cover_url) = '');

update public.destinations d
set cover_url = v.url
from (values
  ('seoul', 'https://images.unsplash.com/photo-1588668214407-6ea9a6d8c272?auto=format&fit=crop&w=800&q=80'),
  ('tokyo', 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80'),
  ('osaka', 'https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?auto=format&fit=crop&w=800&q=80'),
  ('fukuoka', 'https://images.unsplash.com/photo-1522850959516-58f958dde2c1?auto=format&fit=crop&w=800&q=80'),
  ('kyoto', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80'),
  ('taipei', 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80'),
  ('danang', 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80'),
  ('bali', 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=800&q=80'),
  ('cebu', 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=800&q=80'),
  ('sydney', 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?auto=format&fit=crop&w=800&q=80'),
  ('paris', 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=800&q=80'),
  ('rome', 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80'),
  ('prague', 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=800&q=80'),
  ('madrid', 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=800&q=80'),
  ('amsterdam', 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?auto=format&fit=crop&w=800&q=80'),
  ('vienna', 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=800&q=80'),
  ('budapest', 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?auto=format&fit=crop&w=800&q=80'),
  ('venice', 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?auto=format&fit=crop&w=800&q=80'),
  ('newyork', 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=800&q=80'),
  ('hawaii', 'https://images.unsplash.com/photo-1542259009477-d625272157b7?auto=format&fit=crop&w=800&q=80'),
  ('sanfrancisco', 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=800&q=80'),
  ('dubai', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=800&q=80')
) as v(slug, url)
where d.slug = v.slug
  and (d.cover_url is null or btrim(d.cover_url) = '');
