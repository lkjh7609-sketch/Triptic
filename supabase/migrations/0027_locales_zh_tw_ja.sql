-- ============================================================================
-- 0027: 지원 언어 ko/en/zh-TW/ja로 확정 (간체 zh-CN → 번체 zh-TW 교체, 일본어 추가)
-- 07-i18n.md: 표시 언어 4종. 중국어는 대만 번체(zh-TW)만 지원한다.
--
-- ⚠️ 처음 커밋된 버전(ja만 추가)은 프로덕션에 적용되지 않은 채 이 내용으로 바뀌었다.
-- 그 사이 프로덕션에서는 일본어를 고르면 profiles_locale_check에 걸려 저장이 실패했다.
-- ============================================================================

-- 1) profiles.locale — 기존 zh-CN 사용자는 zh-TW로 옮긴다
alter table public.profiles drop constraint if exists profiles_locale_check;
update public.profiles set locale = 'zh-TW' where locale = 'zh-CN';
alter table public.profiles
  add constraint profiles_locale_check check (locale in ('ko', 'en', 'zh-TW', 'ja'));

-- 2) 여행지 번역 — zh-CN 행을 zh-TW로 교체하고 ja 추가
alter table public.destination_translations drop constraint if exists destination_translations_locale_check;
delete from public.destination_translations where locale = 'zh-CN';
alter table public.destination_translations
  add constraint destination_translations_locale_check check (locale in ('ko', 'en', 'zh-TW', 'ja'));

insert into public.destination_translations (destination_id, locale, name)
select d.id, v.locale, v.name
from (values
  ('tokyo', 'zh-TW', '東京'),
  ('tokyo', 'ja', '東京'),
  ('osaka', 'zh-TW', '大阪'),
  ('osaka', 'ja', '大阪'),
  ('kyoto', 'zh-TW', '京都'),
  ('kyoto', 'ja', '京都'),
  ('fukuoka', 'zh-TW', '福岡'),
  ('fukuoka', 'ja', '福岡'),
  ('sapporo', 'zh-TW', '札幌'),
  ('sapporo', 'ja', '札幌'),
  ('okinawa', 'zh-TW', '沖繩'),
  ('okinawa', 'ja', '沖縄'),
  ('nagoya', 'zh-TW', '名古屋'),
  ('nagoya', 'ja', '名古屋'),
  ('beppu', 'zh-TW', '別府'),
  ('beppu', 'ja', '別府'),
  ('bangkok', 'zh-TW', '曼谷'),
  ('bangkok', 'ja', 'バンコク'),
  ('danang', 'zh-TW', '峴港'),
  ('danang', 'ja', 'ダナン'),
  ('nhatrang', 'zh-TW', '芽莊'),
  ('nhatrang', 'ja', 'ニャチャン'),
  ('hochiminh', 'zh-TW', '胡志明市'),
  ('hochiminh', 'ja', 'ホーチミン'),
  ('hanoi', 'zh-TW', '河內'),
  ('hanoi', 'ja', 'ハノイ'),
  ('singapore', 'zh-TW', '新加坡'),
  ('singapore', 'ja', 'シンガポール'),
  ('kualalumpur', 'zh-TW', '吉隆坡'),
  ('kualalumpur', 'ja', 'クアラルンプール'),
  ('bali', 'zh-TW', '峇里島'),
  ('bali', 'ja', 'バリ島'),
  ('cebu', 'zh-TW', '宿霧'),
  ('cebu', 'ja', 'セブ'),
  ('boracay', 'zh-TW', '長灘島'),
  ('boracay', 'ja', 'ボラカイ'),
  ('taipei', 'zh-TW', '台北'),
  ('taipei', 'ja', '台北'),
  ('kaohsiung', 'zh-TW', '高雄'),
  ('kaohsiung', 'ja', '高雄'),
  ('hongkong', 'zh-TW', '香港'),
  ('hongkong', 'ja', '香港'),
  ('macau', 'zh-TW', '澳門'),
  ('macau', 'ja', 'マカオ'),
  ('shanghai', 'zh-TW', '上海'),
  ('shanghai', 'ja', '上海'),
  ('beijing', 'zh-TW', '北京'),
  ('beijing', 'ja', '北京'),
  ('jeju', 'zh-TW', '濟州島'),
  ('jeju', 'ja', '済州島'),
  ('busan', 'zh-TW', '釜山'),
  ('busan', 'ja', '釜山'),
  ('gangneung', 'zh-TW', '江陵'),
  ('gangneung', 'ja', '江陵'),
  ('yeosu', 'zh-TW', '麗水'),
  ('yeosu', 'ja', '麗水'),
  ('gyeongju', 'zh-TW', '慶州'),
  ('gyeongju', 'ja', '慶州'),
  ('jeonju', 'zh-TW', '全州'),
  ('jeonju', 'ja', '全州'),
  ('sokcho', 'zh-TW', '束草'),
  ('sokcho', 'ja', '束草'),
  ('seoul', 'zh-TW', '首爾'),
  ('seoul', 'ja', 'ソウル'),
  ('paris', 'zh-TW', '巴黎'),
  ('paris', 'ja', 'パリ'),
  ('london', 'zh-TW', '倫敦'),
  ('london', 'ja', 'ロンドン'),
  ('rome', 'zh-TW', '羅馬'),
  ('rome', 'ja', 'ローマ'),
  ('barcelona', 'zh-TW', '巴塞隆納'),
  ('barcelona', 'ja', 'バルセロナ'),
  ('prague', 'zh-TW', '布拉格'),
  ('prague', 'ja', 'プラハ'),
  ('vienna', 'zh-TW', '維也納'),
  ('vienna', 'ja', 'ウィーン'),
  ('zurich', 'zh-TW', '蘇黎世'),
  ('zurich', 'ja', 'チューリッヒ'),
  ('amsterdam', 'zh-TW', '阿姆斯特丹'),
  ('amsterdam', 'ja', 'アムステルダム'),
  ('lisbon', 'zh-TW', '里斯本'),
  ('lisbon', 'ja', 'リスボン'),
  ('istanbul', 'zh-TW', '伊斯坦堡'),
  ('istanbul', 'ja', 'イスタンブール'),
  ('newyork', 'zh-TW', '紐約'),
  ('newyork', 'ja', 'ニューヨーク'),
  ('losangeles', 'zh-TW', '洛杉磯'),
  ('losangeles', 'ja', 'ロサンゼルス'),
  ('hawaii', 'zh-TW', '夏威夷'),
  ('hawaii', 'ja', 'ハワイ'),
  ('vancouver', 'zh-TW', '溫哥華'),
  ('vancouver', 'ja', 'バンクーバー'),
  ('sydney', 'zh-TW', '雪梨'),
  ('sydney', 'ja', 'シドニー'),
  ('guam', 'zh-TW', '關島'),
  ('guam', 'ja', 'グアム'),
  ('saipan', 'zh-TW', '塞班島'),
  ('saipan', 'ja', 'サイパン'),
  ('sanfrancisco', 'zh-TW', '舊金山'),
  ('sanfrancisco', 'ja', 'サンフランシスコ')
) as v(slug, locale, name)
join public.destinations d on d.slug = v.slug
on conflict (destination_id, locale) do update set name = excluded.name;
