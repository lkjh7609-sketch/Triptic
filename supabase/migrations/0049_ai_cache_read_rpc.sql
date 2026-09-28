-- ============================================================================
-- 0049: AI 캐시(ai_recommendation_cache)를 앱이 정확한 키로만 바로 읽게 하는 RPC
--
-- 도시 소개/주변 추천은 한 번 생성되면 이 테이블에 저장되지만, 앱은 매번
-- Vercel 함수(/api/cityDesc, /api/recommend)를 거쳐 읽어서 콜드스타트 포함
-- 0.8~2초씩 "AI가 불러오는 중" 화면이 떴다. 캐시에 있으면 Supabase에서 바로
-- 읽고, 없을 때만 /api(=LLM 호출)로 간다.
--
-- 테이블 자체에 SELECT를 열지 않는 이유: place_key에는 사용자가 일정에 넣은
-- 장소 이름(숙소, 지인 집 등)이 그대로 들어 있어서, 전체 조회가 되면 누구나
-- 다른 사람이 물어본 장소 목록을 훑어볼 수 있다. 정확한 키를 아는 경우에만
-- 그 결과(payload)만 돌려준다. 만료는 보지 않는다 — 한 번 받은 결과는 계속 쓴다.
-- ============================================================================

create or replace function public.get_ai_cache(
  p_kind text,
  p_city_key text,
  p_place_key text,
  p_category text,
  p_locale text
)
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $fn$
  select c.payload from public.ai_recommendation_cache c
  where c.kind = p_kind
    and c.city_key = p_city_key
    and c.place_key = p_place_key
    and c.category = p_category
    and c.locale = p_locale;
$fn$;

-- 홈 추천 여행지 카드 여러 개를 한 번에(정확한 도시 키 목록으로만)
create or replace function public.get_city_descriptions(p_city_keys text[], p_locale text)
returns table (city_key text, description text)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select c.city_key, c.payload->>'description'
  from public.ai_recommendation_cache c
  where c.kind = 'city_desc'
    and c.place_key = ''
    and c.category = 'all'
    and c.locale = p_locale
    and c.city_key = any(p_city_keys)
    and cardinality(p_city_keys) <= 50;
$fn$;

revoke all on function public.get_ai_cache(text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_city_descriptions(text[], text) from public, anon, authenticated;
-- 비로그인 샘플 여행에도 AI 추천 버튼이 있어서 anon도 연다(정확한 키 조회만 가능)
grant execute on function public.get_ai_cache(text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_city_descriptions(text[], text) to anon, authenticated;
