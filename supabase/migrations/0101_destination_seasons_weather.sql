-- ============================================================================
-- 0101: 홈 "지금 가기 좋은 여행지" + 도시 채널 날씨용 표 두 개.
-- · destination_seasons: 도시마다 가장 여행가기 좋은 달(best_months)과 월별 기후(monthly). 내용은 별도 마이그레이션(0102)이 채운다.
--     monthly = [[평균 최고기온℃, 평균 최저기온℃, 월 강수량(mm), 비 오는 날 수] × 12달(1월부터)] — 과거 10년 평균.
-- · destination_weather: 하루 한 번 WeatherKit에서 받은 도시별 '오늘' 날씨(api/weather.js?cron=1, Vercel Cron).
--     화면은 이 표만 읽는다(열 때마다 외부 날씨 서비스를 부르지 않는다).
-- 둘 다 읽기는 누구나, 쓰기 정책은 없다(서버의 service_role과 마이그레이션만 쓴다).
-- ============================================================================

create table public.destination_seasons (
  destination_id uuid primary key references public.destinations(id) on delete cascade,
  best_months    smallint[] not null check (cardinality(best_months) between 1 and 12),
  monthly        jsonb not null,
  source         text not null,
  updated_at     timestamptz not null default now(),
  check (jsonb_typeof(monthly) = 'array' and jsonb_array_length(monthly) = 12)
);

-- 이번 달이 best_months에 든 도시를 찾는 조회(@>)용
create index destination_seasons_best_months_idx on public.destination_seasons using gin (best_months);

alter table public.destination_seasons enable row level security;
create policy "public read destination seasons" on public.destination_seasons
  for select using (true);
grant select on public.destination_seasons to anon, authenticated;

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
