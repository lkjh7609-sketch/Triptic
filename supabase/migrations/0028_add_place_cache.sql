-- 장소 좌표 캐싱을 위한 테이블 (Google Places API 호출 절약)
CREATE TABLE public.place_cache (
    query_key text PRIMARY KEY,
    place_id text,
    lat double precision,
    lng double precision,
    address text,
    created_at timestamptz DEFAULT now()
);

-- 누구나 읽을 수 있지만, 서비스 역할(Service Role)만 쓸 수 있도록 RLS 설정
ALTER TABLE public.place_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.place_cache
    AS PERMISSIVE FOR SELECT
    TO public
    USING (true);
