-- ============================================================================
-- 0097: 주변 추천 구성(식당 3·카페 3·볼거리 3)과 구글 현지 이름
--  · get_nearby_ai_places의 최대 반환 수를 20 → 60으로 — 가까운 20곳이 모두 식당이면 카페·볼거리를 못 고르므로, 앱이 넉넉히 받아 묶음별로 고른다.
--  · place_cache에 구글이 그 언어로 저장한 이름(name)을 함께 둔다 — 키는 '언어|검색어'로 바꿔(코드), 언어마다 따로 캐시한다.
-- ============================================================================
alter table public.place_cache add column if not exists name text;

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
           least(greatest(coalesce(p_limit, 10), 1), 60) as lim
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
grant execute on function public.get_nearby_ai_places(double precision, double precision, int, text, int) to anon, authenticated;
