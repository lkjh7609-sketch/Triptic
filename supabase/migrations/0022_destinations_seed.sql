-- ============================================================================
-- 0022: 여행지 초기 시드 50곳 + 3개 언어 번역
-- 출처: docs/specs/06-community.md §2.1
-- 좌표/시간대/통화는 도시 중심 근사치(운영 데이터 정밀도 필요 없음).
-- ============================================================================

with seed as (
  insert into public.destinations (slug, country_code, lat, lng, timezone, currency, is_featured, sort_order)
  values
    -- 일본 (8)
    ('tokyo', 'JP', 35.6762, 139.6503, 'Asia/Tokyo', 'JPY', true, 0),
    ('osaka', 'JP', 34.6937, 135.5023, 'Asia/Tokyo', 'JPY', true, 1),
    ('kyoto', 'JP', 35.0116, 135.7681, 'Asia/Tokyo', 'JPY', false, 2),
    ('fukuoka', 'JP', 33.5904, 130.4017, 'Asia/Tokyo', 'JPY', false, 3),
    ('sapporo', 'JP', 43.0618, 141.3545, 'Asia/Tokyo', 'JPY', false, 4),
    ('okinawa', 'JP', 26.2124, 127.6809, 'Asia/Tokyo', 'JPY', false, 5),
    ('nagoya', 'JP', 35.1815, 136.9066, 'Asia/Tokyo', 'JPY', false, 6),
    ('beppu', 'JP', 33.2846, 131.4913, 'Asia/Tokyo', 'JPY', false, 7),
    -- 동남아 (10)
    ('bangkok', 'TH', 13.7563, 100.5018, 'Asia/Bangkok', 'THB', true, 8),
    ('danang', 'VN', 16.0544, 108.2022, 'Asia/Ho_Chi_Minh', 'VND', true, 9),
    ('nhatrang', 'VN', 12.2388, 109.1967, 'Asia/Ho_Chi_Minh', 'VND', false, 10),
    ('hochiminh', 'VN', 10.8231, 106.6297, 'Asia/Ho_Chi_Minh', 'VND', false, 11),
    ('hanoi', 'VN', 21.0278, 105.8342, 'Asia/Ho_Chi_Minh', 'VND', false, 12),
    ('singapore', 'SG', 1.3521, 103.8198, 'Asia/Singapore', 'SGD', true, 13),
    ('kualalumpur', 'MY', 3.1390, 101.6869, 'Asia/Kuala_Lumpur', 'MYR', false, 14),
    ('bali', 'ID', -8.3405, 115.0920, 'Asia/Makassar', 'IDR', false, 15),
    ('cebu', 'PH', 10.3157, 123.8854, 'Asia/Manila', 'PHP', false, 16),
    ('boracay', 'PH', 11.9674, 121.9248, 'Asia/Manila', 'PHP', false, 17),
    -- 중화권 (6)
    ('taipei', 'TW', 25.0330, 121.5654, 'Asia/Taipei', 'TWD', false, 18),
    ('kaohsiung', 'TW', 22.6273, 120.3014, 'Asia/Taipei', 'TWD', false, 19),
    ('hongkong', 'HK', 22.3193, 114.1694, 'Asia/Hong_Kong', 'HKD', false, 20),
    ('macau', 'MO', 22.1987, 113.5439, 'Asia/Macau', 'MOP', false, 21),
    ('shanghai', 'CN', 31.2304, 121.4737, 'Asia/Shanghai', 'CNY', false, 22),
    ('beijing', 'CN', 39.9042, 116.4074, 'Asia/Shanghai', 'CNY', false, 23),
    -- 국내 (8)
    ('jeju', 'KR', 33.4996, 126.5312, 'Asia/Seoul', 'KRW', true, 24),
    ('busan', 'KR', 35.1796, 129.0756, 'Asia/Seoul', 'KRW', false, 25),
    ('gangneung', 'KR', 37.7519, 128.8761, 'Asia/Seoul', 'KRW', false, 26),
    ('yeosu', 'KR', 34.7604, 127.6622, 'Asia/Seoul', 'KRW', false, 27),
    ('gyeongju', 'KR', 35.8562, 129.2247, 'Asia/Seoul', 'KRW', false, 28),
    ('jeonju', 'KR', 35.8242, 127.1480, 'Asia/Seoul', 'KRW', false, 29),
    ('sokcho', 'KR', 38.2070, 128.5918, 'Asia/Seoul', 'KRW', false, 30),
    ('seoul', 'KR', 37.5665, 126.9780, 'Asia/Seoul', 'KRW', false, 31),
    -- 유럽 (10)
    ('paris', 'FR', 48.8566, 2.3522, 'Europe/Paris', 'EUR', true, 32),
    ('london', 'GB', 51.5072, -0.1276, 'Europe/London', 'GBP', false, 33),
    ('rome', 'IT', 41.9028, 12.4964, 'Europe/Rome', 'EUR', false, 34),
    ('barcelona', 'ES', 41.3874, 2.1686, 'Europe/Madrid', 'EUR', false, 35),
    ('prague', 'CZ', 50.0755, 14.4378, 'Europe/Prague', 'CZK', false, 36),
    ('vienna', 'AT', 48.2082, 16.3738, 'Europe/Vienna', 'EUR', false, 37),
    ('zurich', 'CH', 47.3769, 8.5417, 'Europe/Zurich', 'CHF', false, 38),
    ('amsterdam', 'NL', 52.3676, 4.9041, 'Europe/Amsterdam', 'EUR', false, 39),
    ('lisbon', 'PT', 38.7223, -9.1393, 'Europe/Lisbon', 'EUR', false, 40),
    ('istanbul', 'TR', 41.0082, 28.9784, 'Europe/Istanbul', 'TRY', false, 41),
    -- 미주·오세아니아 (8)
    ('newyork', 'US', 40.7128, -74.0060, 'America/New_York', 'USD', true, 42),
    ('losangeles', 'US', 34.0522, -118.2437, 'America/Los_Angeles', 'USD', false, 43),
    ('hawaii', 'US', 21.3069, -157.8583, 'Pacific/Honolulu', 'USD', false, 44),
    ('vancouver', 'CA', 49.2827, -123.1207, 'America/Vancouver', 'CAD', false, 45),
    ('sydney', 'AU', -33.8688, 151.2093, 'Australia/Sydney', 'AUD', false, 46),
    ('guam', 'GU', 13.4443, 144.7937, 'Pacific/Guam', 'USD', false, 47),
    ('saipan', 'MP', 15.1780, 145.7509, 'Pacific/Saipan', 'USD', false, 48),
    ('sanfrancisco', 'US', 37.7749, -122.4194, 'America/Los_Angeles', 'USD', false, 49)
  returning id, slug
)
insert into public.destination_translations (destination_id, locale, name)
select seed.id, v.locale, v.name
from seed
join (
  values
    ('tokyo', 'ko', '도쿄'), ('tokyo', 'en', 'Tokyo'), ('tokyo', 'zh-CN', '东京'),
    ('osaka', 'ko', '오사카'), ('osaka', 'en', 'Osaka'), ('osaka', 'zh-CN', '大阪'),
    ('kyoto', 'ko', '교토'), ('kyoto', 'en', 'Kyoto'), ('kyoto', 'zh-CN', '京都'),
    ('fukuoka', 'ko', '후쿠오카'), ('fukuoka', 'en', 'Fukuoka'), ('fukuoka', 'zh-CN', '福冈'),
    ('sapporo', 'ko', '삿포로'), ('sapporo', 'en', 'Sapporo'), ('sapporo', 'zh-CN', '札幌'),
    ('okinawa', 'ko', '오키나와'), ('okinawa', 'en', 'Okinawa'), ('okinawa', 'zh-CN', '冲绳'),
    ('nagoya', 'ko', '나고야'), ('nagoya', 'en', 'Nagoya'), ('nagoya', 'zh-CN', '名古屋'),
    ('beppu', 'ko', '벳푸'), ('beppu', 'en', 'Beppu'), ('beppu', 'zh-CN', '别府'),

    ('bangkok', 'ko', '방콕'), ('bangkok', 'en', 'Bangkok'), ('bangkok', 'zh-CN', '曼谷'),
    ('danang', 'ko', '다낭'), ('danang', 'en', 'Da Nang'), ('danang', 'zh-CN', '岘港'),
    ('nhatrang', 'ko', '나트랑'), ('nhatrang', 'en', 'Nha Trang'), ('nhatrang', 'zh-CN', '芽庄'),
    ('hochiminh', 'ko', '호치민'), ('hochiminh', 'en', 'Ho Chi Minh City'), ('hochiminh', 'zh-CN', '胡志明市'),
    ('hanoi', 'ko', '하노이'), ('hanoi', 'en', 'Hanoi'), ('hanoi', 'zh-CN', '河内'),
    ('singapore', 'ko', '싱가포르'), ('singapore', 'en', 'Singapore'), ('singapore', 'zh-CN', '新加坡'),
    ('kualalumpur', 'ko', '쿠알라룸푸르'), ('kualalumpur', 'en', 'Kuala Lumpur'), ('kualalumpur', 'zh-CN', '吉隆坡'),
    ('bali', 'ko', '발리'), ('bali', 'en', 'Bali'), ('bali', 'zh-CN', '巴厘岛'),
    ('cebu', 'ko', '세부'), ('cebu', 'en', 'Cebu'), ('cebu', 'zh-CN', '宿务'),
    ('boracay', 'ko', '보라카이'), ('boracay', 'en', 'Boracay'), ('boracay', 'zh-CN', '长滩岛'),

    ('taipei', 'ko', '타이페이'), ('taipei', 'en', 'Taipei'), ('taipei', 'zh-CN', '台北'),
    ('kaohsiung', 'ko', '가오슝'), ('kaohsiung', 'en', 'Kaohsiung'), ('kaohsiung', 'zh-CN', '高雄'),
    ('hongkong', 'ko', '홍콩'), ('hongkong', 'en', 'Hong Kong'), ('hongkong', 'zh-CN', '香港'),
    ('macau', 'ko', '마카오'), ('macau', 'en', 'Macau'), ('macau', 'zh-CN', '澳门'),
    ('shanghai', 'ko', '상하이'), ('shanghai', 'en', 'Shanghai'), ('shanghai', 'zh-CN', '上海'),
    ('beijing', 'ko', '베이징'), ('beijing', 'en', 'Beijing'), ('beijing', 'zh-CN', '北京'),

    ('jeju', 'ko', '제주'), ('jeju', 'en', 'Jeju'), ('jeju', 'zh-CN', '济州岛'),
    ('busan', 'ko', '부산'), ('busan', 'en', 'Busan'), ('busan', 'zh-CN', '釜山'),
    ('gangneung', 'ko', '강릉'), ('gangneung', 'en', 'Gangneung'), ('gangneung', 'zh-CN', '江陵'),
    ('yeosu', 'ko', '여수'), ('yeosu', 'en', 'Yeosu'), ('yeosu', 'zh-CN', '丽水'),
    ('gyeongju', 'ko', '경주'), ('gyeongju', 'en', 'Gyeongju'), ('gyeongju', 'zh-CN', '庆州'),
    ('jeonju', 'ko', '전주'), ('jeonju', 'en', 'Jeonju'), ('jeonju', 'zh-CN', '全州'),
    ('sokcho', 'ko', '속초'), ('sokcho', 'en', 'Sokcho'), ('sokcho', 'zh-CN', '束草'),
    ('seoul', 'ko', '서울'), ('seoul', 'en', 'Seoul'), ('seoul', 'zh-CN', '首尔'),

    ('paris', 'ko', '파리'), ('paris', 'en', 'Paris'), ('paris', 'zh-CN', '巴黎'),
    ('london', 'ko', '런던'), ('london', 'en', 'London'), ('london', 'zh-CN', '伦敦'),
    ('rome', 'ko', '로마'), ('rome', 'en', 'Rome'), ('rome', 'zh-CN', '罗马'),
    ('barcelona', 'ko', '바르셀로나'), ('barcelona', 'en', 'Barcelona'), ('barcelona', 'zh-CN', '巴塞罗那'),
    ('prague', 'ko', '프라하'), ('prague', 'en', 'Prague'), ('prague', 'zh-CN', '布拉格'),
    ('vienna', 'ko', '빈'), ('vienna', 'en', 'Vienna'), ('vienna', 'zh-CN', '维也纳'),
    ('zurich', 'ko', '취리히'), ('zurich', 'en', 'Zurich'), ('zurich', 'zh-CN', '苏黎世'),
    ('amsterdam', 'ko', '암스테르담'), ('amsterdam', 'en', 'Amsterdam'), ('amsterdam', 'zh-CN', '阿姆斯特丹'),
    ('lisbon', 'ko', '리스본'), ('lisbon', 'en', 'Lisbon'), ('lisbon', 'zh-CN', '里斯本'),
    ('istanbul', 'ko', '이스탄불'), ('istanbul', 'en', 'Istanbul'), ('istanbul', 'zh-CN', '伊斯坦布尔'),

    ('newyork', 'ko', '뉴욕'), ('newyork', 'en', 'New York'), ('newyork', 'zh-CN', '纽约'),
    ('losangeles', 'ko', 'LA'), ('losangeles', 'en', 'Los Angeles'), ('losangeles', 'zh-CN', '洛杉矶'),
    ('hawaii', 'ko', '하와이'), ('hawaii', 'en', 'Hawaii'), ('hawaii', 'zh-CN', '夏威夷'),
    ('vancouver', 'ko', '밴쿠버'), ('vancouver', 'en', 'Vancouver'), ('vancouver', 'zh-CN', '温哥华'),
    ('sydney', 'ko', '시드니'), ('sydney', 'en', 'Sydney'), ('sydney', 'zh-CN', '悉尼'),
    ('guam', 'ko', '괌'), ('guam', 'en', 'Guam'), ('guam', 'zh-CN', '关岛'),
    ('saipan', 'ko', '사이판'), ('saipan', 'en', 'Saipan'), ('saipan', 'zh-CN', '塞班岛'),
    ('sanfrancisco', 'ko', '샌프란시스코'), ('sanfrancisco', 'en', 'San Francisco'), ('sanfrancisco', 'zh-CN', '旧金山')
) as v(slug, locale, name) on v.slug = seed.slug;
