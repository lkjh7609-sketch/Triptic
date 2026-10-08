-- ============================================================================
-- 0101: 홈 "지금 가기 좋은 여행지"·도시 채널 날씨용 표 — destination_weather.
-- 하루 한 번 WeatherKit에서 받은 도시별 '오늘' 날씨(api/weather.js?cron=1, Vercel Cron). 화면은 이 표만 읽는다(열 때마다 외부 날씨 서비스를 부르지 않는다).
-- 읽기는 누구나, 쓰기 정책은 없다(서버의 service_role과 마이그레이션만 쓴다).
-- (도시별 '가기 좋은 달'과 월별 기후는 DB가 아니라 앱에 포함한 정적 파일 src/features/home/stitch/seasonClimate.json — 바뀔 일이 없는 자료라서.)
-- ============================================================================

create table public.destination_weather (
  destination_id uuid primary key references public.destinations(id) on delete cascade,
  -- 그 도시의 현지 날짜(오늘)
  date           date not null,
  tmax_c         numeric(4,1),
  tmin_c         numeric(4,1),
  -- WeatherKit 원본 날씨 코드(화면이 9종으로 줄여 아이콘을 고른다)
  condition_code text,
  -- 0~1
  precip_chance  numeric(3,2) check (precip_chance is null or precip_chance between 0 and 1),
  updated_at     timestamptz not null default now()
);

alter table public.destination_weather enable row level security;
create policy "public read destination weather" on public.destination_weather
  for select using (true);
grant select on public.destination_weather to anon, authenticated;
