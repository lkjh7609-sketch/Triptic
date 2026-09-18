-- Triptic Database Schema for Supabase
-- 여행 프로젝트, 일정, 공유 링크, 동행자 제안 관리
--
-- 저장 전략: 각 여행의 전체 상태(일정/숙소/항공편/경비 등)는 트리 구조 그대로
-- trips.snapshot(JSONB)에 저장한다. 이는 과거 Firebase Realtime DB에 저장하던
-- payload와 동일한 형태로, 클라이언트 저장 로직을 크게 바꾸지 않으면서도
-- Supabase Auth + RLS로 사용자별/공유별 접근 통제를 걸 수 있게 한다.
--
-- places/hotels/flights/expenses 테이블은 향후 일차별 정규화 쿼리(예: 특정
-- 장소 검색, 경비 집계)가 필요해질 때를 위해 남겨두되, 현재 애플리케이션
-- 코드는 이 테이블들에 쓰지 않는다 (미사용 상태를 스키마 주석으로 명시).
--
-- 이 스크립트는 CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS 위주로 작성되어
-- 기존 프로젝트에 재적용해도 안전하다. 단, 아래 두 항목은 이전 버전(Firebase
-- 기반 기기 백업 코드 기능)에서 쓰이던 것으로 이번 개편에서 완전히 대체되었다.
-- 기존 데이터가 없다면 Supabase SQL Editor에서 아래를 직접 실행해 정리해도 된다:
--   DROP TABLE IF EXISTS public.backup_mappings;
--   DROP FUNCTION IF EXISTS migrate_from_localstorage(UUID, JSON);
-- (본 스크립트는 위 DROP을 자동 실행하지 않는다 — 기존 데이터 유무를 알 수 없으므로
--  파괴적 작업은 직접 확인 후 실행하는 것을 권장한다.)

-- 1. 사용자 테이블 (Supabase Auth 사용 시 필요)
-- auth.users는 Supabase에서 자동 생성되므로 프로필만 확장
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    guest_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 여행 프로젝트 테이블
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    city TEXT,
    city_lat DECIMAL(10, 8),
    city_lng DECIMAL(11, 8),
    start_date DATE,
    end_date DATE,
    total_days INTEGER,
    currency TEXT DEFAULT 'KRW',
    -- 클라이언트의 전체 여행 상태(plannerData/hotels/meals/expenses/flights/dayCities)를
    -- 그대로 담는 스냅샷. 실제 저장/로드/공유 경로의 단일 진실 공급원.
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 일차별 장소 데이터 (예약됨 — 현재 애플리케이션 코드는 미사용)
CREATE TABLE IF NOT EXISTS public.places (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    position INTEGER NOT NULL, -- 순서
    name TEXT NOT NULL,
    address TEXT,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    time TIME,
    memo TEXT,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'cafe')),
    place_id TEXT, -- Google Places ID
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_trip_day_position UNIQUE (trip_id, day, position)
);

-- 4. 숙소 데이터 (예약됨 — 현재 애플리케이션 코드는 미사용)
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    place_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_trip_day_hotel UNIQUE (trip_id, day)
);

-- 5. 항공편 데이터 (예약됨 — 현재 애플리케이션 코드는 미사용)
CREATE TABLE IF NOT EXISTS public.flights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('outbound', 'return')),
    flight_no TEXT,
    airline TEXT,
    dep_iata TEXT,
    dep_name TEXT,
    dep_time TEXT,
    arr_iata TEXT,
    arr_name TEXT,
    arr_time TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_trip_flight_type UNIQUE (trip_id, type)
);

-- 6. 경비 데이터 (예약됨 — 현재 애플리케이션 코드는 미사용)
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    day INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    category TEXT CHECK (category IN ('food', 'transport', 'accommodation', 'shopping', 'other')),
    payment_method TEXT CHECK (payment_method IN ('cash', 'card')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 공유 링크 (보기 전용 공유) — share_code를 아는 사람은 누구나 해당 trip의
--    snapshot을 읽을 수 있다. 소유자만 생성/해제 가능.
CREATE TABLE IF NOT EXISTS public.shared_trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    share_code TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 동행자 제안 (공유 중인 여행에 누구나 장소를 건의) — 삭제된 Firebase
--    /suggestions/{shareId}/{id} 경로를 대체.
CREATE TABLE IF NOT EXISTS public.suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    day INTEGER NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    memo TEXT,
    proposer TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS idx_places_trip_day ON public.places(trip_id, day);
CREATE INDEX IF NOT EXISTS idx_places_position ON public.places(trip_id, day, position);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_day ON public.expenses(trip_id, day);
CREATE INDEX IF NOT EXISTS idx_shared_trips_code ON public.shared_trips(share_code);
CREATE INDEX IF NOT EXISTS idx_shared_trips_trip_id ON public.shared_trips(trip_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_trip_id ON public.suggestions(trip_id);

-- Row Level Security (RLS) 활성화
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- 기존 정책 재실행을 위한 정리 (이 스크립트를 재적용할 때 충돌 방지)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can view own or shared trips" ON public.trips;
DROP POLICY IF EXISTS "Users can insert own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can manage own places" ON public.places;
DROP POLICY IF EXISTS "Users can manage own hotels" ON public.hotels;
DROP POLICY IF EXISTS "Users can manage own flights" ON public.flights;
DROP POLICY IF EXISTS "Users can manage own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Anyone can view shared trips" ON public.shared_trips;
DROP POLICY IF EXISTS "Users can manage own shared links" ON public.shared_trips;
DROP POLICY IF EXISTS "Users can update own shared links" ON public.shared_trips;
DROP POLICY IF EXISTS "Users can delete own shared links" ON public.shared_trips;
DROP POLICY IF EXISTS "Anyone can suggest on shared trips" ON public.suggestions;
DROP POLICY IF EXISTS "Owners can view suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Owners can delete suggestions" ON public.suggestions;

-- ── user_profiles ────────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

-- 최초 로그인 시 syncUserProfile()의 upsert가 성공하려면 INSERT 정책이 필요함
-- (이전 스키마에는 이 정책이 없어 신규 사용자의 프로필 생성이 항상 실패했음)
CREATE POLICY "Users can insert own profile"
    ON public.user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

-- ── trips ────────────────────────────────────────────────────────
-- 소유자이거나, 만료되지 않은 공유 링크(shared_trips)가 존재하는 여행만 조회 가능
CREATE POLICY "Users can view own or shared trips"
    ON public.trips FOR SELECT
    USING (
        auth.uid() = user_id
        OR EXISTS (
            SELECT 1 FROM public.shared_trips st
            WHERE st.trip_id = trips.id
            AND (st.expires_at IS NULL OR st.expires_at > NOW())
        )
    );

CREATE POLICY "Users can insert own trips"
    ON public.trips FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
    ON public.trips FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
    ON public.trips FOR DELETE
    USING (auth.uid() = user_id);

-- ── places / hotels / flights / expenses (예약, 현재 미사용) ───────
CREATE POLICY "Users can manage own places"
    ON public.places FOR ALL
    USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = places.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can manage own hotels"
    ON public.hotels FOR ALL
    USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = hotels.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can manage own flights"
    ON public.flights FOR ALL
    USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = flights.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Users can manage own expenses"
    ON public.expenses FOR ALL
    USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = expenses.trip_id AND trips.user_id = auth.uid()));

-- ── shared_trips ─────────────────────────────────────────────────
-- share_code를 아는 사람은 누구나 공유 레코드 자체는 읽을 수 있음(뷰어가
-- share_code로 trip_id를 찾아야 하므로). 실제 여행 데이터 접근은 위 trips
-- SELECT 정책이 다시 한 번 검증한다.
CREATE POLICY "Anyone can view shared trip links"
    ON public.shared_trips FOR SELECT
    USING (TRUE);

CREATE POLICY "Owners can create shared links"
    ON public.shared_trips FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = shared_trips.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Owners can update own shared links"
    ON public.shared_trips FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = shared_trips.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Owners can delete own shared links"
    ON public.shared_trips FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = shared_trips.trip_id AND trips.user_id = auth.uid()));

-- ── suggestions ──────────────────────────────────────────────────
-- 공유 중(만료되지 않은 shared_trips 존재)인 여행에는 인증 없이도(anon) 제안을
-- 남길 수 있음. 조회/삭제는 여행 소유자만.
CREATE POLICY "Anyone can suggest on shared trips"
    ON public.suggestions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.shared_trips st
            WHERE st.trip_id = suggestions.trip_id
            AND (st.expires_at IS NULL OR st.expires_at > NOW())
        )
    );

CREATE POLICY "Owners can view suggestions"
    ON public.suggestions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = suggestions.trip_id AND trips.user_id = auth.uid()));

CREATE POLICY "Owners can delete suggestions"
    ON public.suggestions FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.trips WHERE trips.id = suggestions.trip_id AND trips.user_id = auth.uid()));

-- anon 역할에 필요한 최소 테이블 권한 명시적 부여 (RLS가 행 단위로 다시 제한함)
GRANT SELECT ON public.trips, public.shared_trips TO anon;
GRANT INSERT ON public.suggestions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.user_profiles, public.trips, public.places, public.hotels,
    public.flights, public.expenses, public.shared_trips, public.suggestions
    TO authenticated;

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_trips_updated_at ON public.trips;
CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_places_updated_at ON public.places;
CREATE TRIGGER update_places_updated_at
    BEFORE UPDATE ON public.places
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 함수: share_code로 공개 조회 (뷰어는 anon, RLS를 우회하되 만료/존재 여부를
-- 함수 내부에서 직접 검증 — 과거 get_trip_full_data는 이 검증이 없어 임의의
-- trip_uuid로 아무 여행이나 읽을 수 있는 취약점이 있었음)
CREATE OR REPLACE FUNCTION get_shared_trip(p_share_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result JSON;
BEGIN
    -- 클라이언트(openSharedView/applySharedUpdate)가 기대하는 형태로 snapshot을
    -- 최상위로 펼쳐서 반환한다 (구 Firebase 공유 payload와 동일한 모양).
    SELECT json_build_object(
        'tripId', t.id,
        'projectName', t.name,
        'city', t.city,
        'cityLat', t.city_lat,
        'cityLng', t.city_lng,
        'startDate', t.start_date,
        'endDate', t.end_date,
        'currency', t.currency,
        'data', t.snapshot->'data',
        'hotels', t.snapshot->'hotels',
        'meals', t.snapshot->'meals',
        'expenses', t.snapshot->'expenses',
        'flights', t.snapshot->'flights',
        'dayCities', t.snapshot->'dayCities',
        'updatedAt', extract(epoch FROM t.updated_at) * 1000
    ) INTO result
    FROM public.trips t
    JOIN public.shared_trips st ON st.trip_id = t.id
    WHERE st.share_code = p_share_code
    AND (st.expires_at IS NULL OR st.expires_at > NOW())
    ORDER BY st.created_at DESC
    LIMIT 1;

    -- 조회수 집계 (best-effort, 실패해도 조회 자체는 성공해야 함)
    UPDATE public.shared_trips
    SET view_count = view_count + 1, last_viewed_at = NOW()
    WHERE share_code = p_share_code;

    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION get_shared_trip(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_shared_trip(TEXT) TO anon, authenticated;

-- 함수: 여행 전체 데이터 조회 (레거시 — 정규화 테이블 기반, 현재 애플리케이션은
-- 호출하지 않음). 호출자가 소유자이거나 공유 중일 때만 반환하도록 수정하여
-- SECURITY DEFINER로 인한 RLS 우회 취약점을 제거함.
CREATE OR REPLACE FUNCTION get_trip_full_data(trip_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result JSON;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.trips t
        WHERE t.id = trip_uuid
        AND (
            t.user_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.shared_trips st
                WHERE st.trip_id = t.id
                AND (st.expires_at IS NULL OR st.expires_at > NOW())
            )
        )
    ) THEN
        RETURN NULL;
    END IF;

    SELECT json_build_object(
        'trip', row_to_json(t.*),
        'places', (SELECT json_agg(p ORDER BY p.day, p.position) FROM public.places p WHERE p.trip_id = trip_uuid),
        'hotels', (SELECT json_object_agg(h.day::TEXT, row_to_json(h)) FROM public.hotels h WHERE h.trip_id = trip_uuid),
        'flights', (SELECT json_object_agg(f.type, row_to_json(f)) FROM public.flights f WHERE f.trip_id = trip_uuid),
        'expenses', (SELECT json_agg(e ORDER BY e.day, e.created_at) FROM public.expenses e WHERE e.trip_id = trip_uuid)
    ) INTO result
    FROM public.trips t
    WHERE t.id = trip_uuid;

    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION get_trip_full_data(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_trip_full_data(UUID) TO authenticated;

COMMENT ON TABLE public.trips IS '여행 프로젝트 메타 정보 + 전체 상태 스냅샷(snapshot)';
COMMENT ON TABLE public.places IS '일차별 방문 장소 데이터 (예약 — 현재 미사용)';
COMMENT ON TABLE public.hotels IS '일차별 숙소 데이터 (예약 — 현재 미사용)';
COMMENT ON TABLE public.flights IS '항공편 정보 (예약 — 현재 미사용)';
COMMENT ON TABLE public.expenses IS '여행 경비 내역 (예약 — 현재 미사용)';
COMMENT ON TABLE public.shared_trips IS '보기 전용 공유 링크 관리';
COMMENT ON TABLE public.suggestions IS '공유받은 동행자가 제안한 장소 (구 Firebase /suggestions 대체)';
