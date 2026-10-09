-- ============================================================================
-- 0106: 호텔명 검색 색인 — 아고다 호텔 데이터(제휴 포털 CSV)에서 후기 10개 이상인 숙소만(2026-10-09 기준 331,323곳)
--
-- 아고다 제휴 검색 API는 이름 검색이 없고 도시 ID 또는 **호텔 ID 목록**(Hotel List Search)만 받는다.
-- 그래서 이름 → 호텔 ID를 우리 DB에서 찾고, 가격은 그 ID로 API에 묻는다. 데이터는 scripts/agoda/ 의 두 스크립트로 넣는다
-- (CSV 추출 → REST 일괄 입력). 아고다가 파일을 새로 주면 같은 방식으로 다시 넣는다(upsert).
-- 색인(2026-10-09 운영 실측, 표 전체 약 97MB):
--   · 영어 이름: trigram(lower(name)) — 영어 3글자 이상에서 색인을 탄다
--   · 한국어 이름: 2글자 조각 배열(agoda_bigrams) GIN — trigram은 한글 2글자("신라")에 색인을 못 써서 전체 훑기(0.2~2초)였다.
--     PGroonga도 시험했지만 고정 용량이 커서(한국어 이름만 걸어도 약 140MB) 뺐다(0107).
-- 서버(service_role)만 읽는다(앱은 /api 를 거친다).
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.agoda_hotels (
  hotel_id  integer primary key,
  name      text not null,
  name_ko   text,
  city_id   integer not null,
  city      text,
  country   text,
  lat       double precision,
  lng       double precision,
  stars     real,
  reviews   integer not null default 0,
  rating    real
);

alter table public.agoda_hotels enable row level security;
revoke all on table public.agoda_hotels from anon, authenticated;

-- 띄어쓰기를 뺀 소문자 글자의 연속 2글자 조각(중복 없음) — 한국어 이름 색인과 검색어에 같은 함수를 쓴다
create or replace function public.agoda_bigrams(t text) returns text[]
language sql immutable parallel safe
set search_path = pg_catalog
as $bg$
  select coalesce(array_agg(distinct substr(s, i, 2)), '{}'::text[])
  from (select lower(regexp_replace(coalesce(t, ''), '\s+', '', 'g')) as s) x,
       generate_series(1, greatest(char_length(x.s) - 1, 0)) as i
$bg$;

create index if not exists agoda_hotels_city_idx on public.agoda_hotels (city_id);
create index if not exists agoda_hotels_name_trgm on public.agoda_hotels using gin (lower(name) extensions.gin_trgm_ops);
create index if not exists agoda_hotels_name_ko_bigrams on public.agoda_hotels using gin (public.agoda_bigrams(name_ko)) where name_ko is not null;

-- 호텔명 검색. 띄어 쓴 단어마다 이름에 모두 들어 있어야 한다(순서 무관 — "도쿄 힐튼" = "힐튼 도쿄").
--  · 영어·숫자 단어: 영어 이름(lower(name))에서 — trigram 색인(3글자 이상일 때 색인을 탄다)
--  · 한글·가나 등이 섞인 단어: 한국어 이름(name_ko, 띄어쓰기 무시)에서 — 2글자 조각 색인(agoda_bigrams)
--  · '호텔·hotel·리조트·resort'만 있는 단어는 다른 단어가 있으면 빼고, 한글 단어 끝의 '호텔·리조트'도 떼어 찾는다("신라호텔" → "신라")
--  · 색인을 탈 단어(영어 3글자+ 또는 한글 2글자+)가 하나도 없으면 빈 결과(전체 훑기 방지)
-- 순서: 입력 그대로(띄어쓰기 무시)가 이름에 들어 있는 것 먼저, 그다음 후기 많은 순
create or replace function public.search_agoda_hotels(p_q text, p_limit int default 10)
returns table (
  hotel_id integer, name text, name_ko text, city_id integer, city text, country text,
  lat double precision, lng double precision, stars real, reviews integer, rating real
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_full text := lower(regexp_replace(coalesce(p_q, ''), '\s+', '', 'g'));
  v_tokens text[];
  v_tok text;
  v_conds text[] := '{}';
  v_indexed boolean := false;
  v_limit int := least(greatest(coalesce(p_limit, 10), 1), 20);
begin
  select coalesce(array_agg(t), '{}') into v_tokens
  from unnest(regexp_split_to_array(lower(trim(coalesce(p_q, ''))), '\s+')) as t
  where t <> '';
  if cardinality(v_tokens) > 1 then
    v_tokens := coalesce((select array_agg(t) from unnest(v_tokens) t where t not in ('호텔', 'hotel', 'hotels', '리조트', 'resort', 'resorts')), v_tokens);
  end if;
  if cardinality(v_tokens) = 0 or cardinality(v_tokens) > 6 then
    return;
  end if;

  foreach v_tok in array v_tokens loop
    if v_tok ~ '[^\x01-\x7f]' then
      if char_length(v_tok) > 3 then
        v_tok := regexp_replace(v_tok, '(호텔|리조트)$', '');
      end if;
      if char_length(v_tok) >= 2 then
        v_indexed := true;
        v_conds := v_conds || format('(h.name_ko is not null and public.agoda_bigrams(h.name_ko) @> public.agoda_bigrams(%L) and lower(regexp_replace(h.name_ko, ''\s+'', '''', ''g'')) like %L)',
                                     v_tok, '%' || v_tok || '%');
      else
        v_conds := v_conds || format('lower(regexp_replace(coalesce(h.name_ko, ''''), ''\s+'', '''', ''g'')) like %L', '%' || v_tok || '%');
      end if;
    else
      if char_length(v_tok) >= 3 then
        v_indexed := true;
      end if;
      v_conds := v_conds || format('lower(h.name) like %L', '%' || v_tok || '%');
    end if;
  end loop;

  if not v_indexed then
    return;
  end if;

  return query execute format(
    'select h.hotel_id, h.name, h.name_ko, h.city_id, h.city, h.country, h.lat, h.lng, h.stars, h.reviews, h.rating
       from public.agoda_hotels h
      where %s
      order by (lower(regexp_replace(h.name || coalesce(h.name_ko, ''''), ''\s+'', '''', ''g'')) like %L) desc,
               h.reviews desc
      limit %s',
    array_to_string(v_conds, ' and '), '%' || v_full || '%', v_limit);
end;
$fn$;

revoke all on function public.search_agoda_hotels(text, int) from public, anon, authenticated;
grant execute on function public.search_agoda_hotels(text, int) to service_role;
