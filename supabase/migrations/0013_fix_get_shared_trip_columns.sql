-- ============================================================================
-- 0013: get_shared_trip 컬럼명 불일치 수정
--
-- 0000_reconcile_legacy_schema.sql이 trips.name→title, trips.currency→
-- base_currency로 컬럼명을 정합화했지만, get_shared_trip(snapshot 기반 버전)은
-- 여전히 옛 컬럼명(t.name, t.currency)을 참조하고 있었다 — 존재하지 않는
-- 컬럼이라 공유 링크를 실제로 열면 함수 자체가 에러를 냈다(프로덕션 버그).
-- 컬럼 참조만 고치고 반환 JSON의 키(projectName, currency 등)와 로직은 그대로
-- 둔다 — 0008(정규화 테이블 전환)이 적용되기 전까지는 이 snapshot 기반 버전이
-- 계속 쓰인다.
-- ============================================================================

create or replace function public.get_shared_trip(p_share_code text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
    result json;
begin
    select json_build_object(
        'tripId', t.id,
        'projectName', t.title,
        'city', t.city,
        'cityLat', t.city_lat,
        'cityLng', t.city_lng,
        'startDate', t.start_date,
        'endDate', t.end_date,
        'currency', t.base_currency,
        'data', t.snapshot->'data',
        'hotels', t.snapshot->'hotels',
        'meals', t.snapshot->'meals',
        'expenses', t.snapshot->'expenses',
        'flights', t.snapshot->'flights',
        'dayCities', t.snapshot->'dayCities',
        'updatedAt', extract(epoch from t.updated_at) * 1000
    ) into result
    from public.trips t
    join public.shared_trips st on st.trip_id = t.id
    where st.share_code = p_share_code
    and (st.expires_at is null or st.expires_at > now())
    order by st.created_at desc
    limit 1;

    update public.shared_trips
    set view_count = view_count + 1, last_viewed_at = now()
    where share_code = p_share_code;

    return result;
end;
$function$;
