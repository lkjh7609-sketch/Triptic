-- ============================================================================
-- 0050: AI 주변 추천 장소 풀 — 반경 1.5km 안에 이미 쌓인 장소부터 쓰고,
--        모자랄 때만 AI를 불러 새 장소를 풀에 더한다
--
-- 기존 주변 추천 캐시(ai_recommendation_cache kind='nearby')는 "기준 장소 이름"별로만
-- 저장돼서, 50m 떨어진 다른 장소를 기준으로 하면 또 AI를 불렀다. 이제 추천된 장소
-- 자체(Google place_id + 좌표 + AI 설명)를 언어별로 쌓고, 기준점 좌표 반경 안에서 찾는다.
--
-- 개인정보: 이 테이블에는 공개 장소(구글 place_id/이름/좌표)와 AI 설명만 들어간다 —
-- 사용자가 일정에 넣은 기준 장소 이름은 어디에도 저장하지 않는다. 시도 기록도
-- 이름이 아니라 약 500m 격자 칸 좌표로 남긴다.
--
-- 읽기는 반경 상한(3km)과 개수 상한(20)이 걸린 SECURITY DEFINER 함수로만, 쓰기는
-- 서버(service_role, /api/recommend)만 한다.
-- ============================================================================

create table public.ai_places (
  id             bigserial primary key,
  place_id       text not null,
  locale         text not null check (locale in ('ko', 'en', 'zh-TW', 'ja')),
  name           text not null,
  lat            double precision not null,
  lng            double precision not null,
  address        text,
  category       text not null default 'spot' check (category in ('restaurant', 'cafe', 'culture', 'spot')),
  category_label text,
  signature_menu text,
  price_range    text,
  reason         text,
  tip            text,
  provider       text,
  model_used     text,
  created_at     timestamptz not null default now(),
  unique (place_id, locale)
);
create index ai_places_geo_idx on public.ai_places (locale, lat, lng);

-- 같은 칸(약 500m)에서 AI를 이미 한 번 불렀는지 — 장소가 드문 곳에서 열 때마다 AI를
-- 다시 부르지 않게 한다(이름이 아니라 좌표 격자로만 기록)
create table public.ai_place_attempts (
  locale       text not null,
  cell_lat     int not null,
  cell_lng     int not null,
  attempted_at timestamptz not null default now(),
  primary key (locale, cell_lat, cell_lng)
);

alter table public.ai_places enable row level security;
alter table public.ai_place_attempts enable row level security;
revoke all on public.ai_places from anon, authenticated;
revoke all on public.ai_place_attempts from anon, authenticated;
revoke all on sequence public.ai_places_id_seq from anon, authenticated;

create or replace function public.get_nearby_ai_places(
  p_lat double precision,
  p_lng double precision,
  p_radius_m int,
  p_locale text,
  p_limit int default 10
)
returns table (
  place_id text,
  name text,
  lat double precision,
  lng double precision,
  address text,
  category text,
  category_label text,
  signature_menu text,
  price_range text,
  reason text,
  tip text,
  distance_m double precision
)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  with params as (
    select least(greatest(coalesce(p_radius_m, 1500), 1), 3000)::double precision as r,
           least(greatest(coalesce(p_limit, 10), 1), 20) as lim
  )
  select p.place_id, p.name, p.lat, p.lng, p.address, p.category, p.category_label,
         p.signature_menu, p.price_range, p.reason, p.tip, d.dist
  from public.ai_places p
  cross join params
  cross join lateral (
    select 2 * 6371000 * asin(sqrt(
      power(sin(radians(p.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(p.lat)) * power(sin(radians(p.lng - p_lng) / 2), 2)
    )) as dist
  ) d
  where p.locale = p_locale
    and p_lat between -90 and 90
    and p_lng between -180 and 180
    -- 인덱스를 타는 사각형으로 먼저 줄이고 대권거리로 정확히 자른다
    and p.lat between p_lat - params.r / 111320.0 and p_lat + params.r / 111320.0
    and p.lng between p_lng - params.r / (111320.0 * greatest(cos(radians(p_lat)), 0.01))
                  and p_lng + params.r / (111320.0 * greatest(cos(radians(p_lat)), 0.01))
    and d.dist <= params.r
  order by d.dist
  limit (select lim from params);
$fn$;

revoke all on function public.get_nearby_ai_places(double precision, double precision, int, text, int) from public, anon, authenticated;
-- 비로그인 샘플 여행에도 AI 추천 버튼이 있어서 anon도 연다
grant execute on function public.get_nearby_ai_places(double precision, double precision, int, text, int) to anon, authenticated;
