-- Triptic Database Schema for Supabase
-- 여행 프로젝트, 일정, 공유 링크 관리

-- 1. 사용자 테이블 (Supabase Auth 사용 시 필요)
-- auth.users는 Supabase에서 자동 생성되므로 프로필만 확장
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    guest_name TEXT,
    backup_code TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 여행 프로젝트 테이블
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    city TEXT,
    city_lat DECIMAL(10, 8),
    city_lng DECIMAL(11, 8),
    start_date DATE,
    end_date DATE,
    total_days INTEGER,
    currency TEXT DEFAULT 'KRW',
    share_id TEXT UNIQUE,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 일차별 장소 데이터
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

-- 4. 숙소 데이터
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

-- 5. 항공편 데이터
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

-- 6. 경비 데이터
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

-- 7. 공유 링크 추적 (읽기 전용 공유)
CREATE TABLE IF NOT EXISTS public.shared_trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    share_code TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 백업 코드 매핑 (기기 간 동기화)
CREATE TABLE IF NOT EXISTS public.backup_mappings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_code TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    trip_ids UUID[] DEFAULT '{}', -- 여러 여행 포함 가능
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_trips_user_id ON public.trips(user_id);
CREATE INDEX idx_trips_share_id ON public.trips(share_id) WHERE share_id IS NOT NULL;
CREATE INDEX idx_places_trip_day ON public.places(trip_id, day);
CREATE INDEX idx_places_position ON public.places(trip_id, day, position);
CREATE INDEX idx_expenses_trip_day ON public.expenses(trip_id, day);
CREATE INDEX idx_shared_trips_code ON public.shared_trips(share_code);
CREATE INDEX idx_backup_code ON public.backup_mappings(backup_code);

-- Row Level Security (RLS) 활성화
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_mappings ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 데이터만 접근
CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can view own trips"
    ON public.trips FOR SELECT
    USING (auth.uid() = user_id OR is_shared = TRUE);

CREATE POLICY "Users can insert own trips"
    ON public.trips FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
    ON public.trips FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
    ON public.trips FOR DELETE
    USING (auth.uid() = user_id);

-- Places, Hotels, Flights, Expenses도 동일한 패턴으로 RLS 적용
CREATE POLICY "Users can manage own places"
    ON public.places FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.trips
            WHERE trips.id = places.trip_id
            AND trips.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own hotels"
    ON public.hotels FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.trips
            WHERE trips.id = hotels.trip_id
            AND trips.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own flights"
    ON public.flights FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.trips
            WHERE trips.id = flights.trip_id
            AND trips.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage own expenses"
    ON public.expenses FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.trips
            WHERE trips.id = expenses.trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- 공유 링크는 누구나 읽기 가능
CREATE POLICY "Anyone can view shared trips"
    ON public.shared_trips FOR SELECT
    USING (TRUE);

CREATE POLICY "Users can manage own shared links"
    ON public.shared_trips FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.trips
            WHERE trips.id = shared_trips.trip_id
            AND trips.user_id = auth.uid()
        )
    );

-- 백업 코드는 소유자만 접근
CREATE POLICY "Users can view own backups"
    ON public.backup_mappings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own backups"
    ON public.backup_mappings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- 트리거: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_places_updated_at
    BEFORE UPDATE ON public.places
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 함수: 여행 전체 데이터 조회 (JOIN 최적화)
CREATE OR REPLACE FUNCTION get_trip_full_data(trip_uuid UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'trip', row_to_json(t.*),
        'places', (
            SELECT json_agg(p ORDER BY p.day, p.position)
            FROM public.places p
            WHERE p.trip_id = trip_uuid
        ),
        'hotels', (
            SELECT json_object_agg(h.day::TEXT, row_to_json(h))
            FROM public.hotels h
            WHERE h.trip_id = trip_uuid
        ),
        'flights', (
            SELECT json_object_agg(f.type, row_to_json(f))
            FROM public.flights f
            WHERE f.trip_id = trip_uuid
        ),
        'expenses', (
            SELECT json_agg(e ORDER BY e.day, e.created_at)
            FROM public.expenses e
            WHERE e.trip_id = trip_uuid
        )
    ) INTO result
    FROM public.trips t
    WHERE t.id = trip_uuid;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 함수: localStorage에서 Supabase로 마이그레이션
CREATE OR REPLACE FUNCTION migrate_from_localstorage(
    p_user_id UUID,
    p_trip_data JSON
)
RETURNS UUID AS $$
DECLARE
    new_trip_id UUID;
BEGIN
    -- 여행 생성
    INSERT INTO public.trips (
        user_id, name, city, city_lat, city_lng,
        start_date, end_date, total_days, currency
    ) VALUES (
        p_user_id,
        p_trip_data->>'name',
        p_trip_data->>'city',
        (p_trip_data->>'cityLat')::DECIMAL,
        (p_trip_data->>'cityLng')::DECIMAL,
        (p_trip_data->>'startDate')::DATE,
        (p_trip_data->>'endDate')::DATE,
        (p_trip_data->>'totalDays')::INTEGER,
        COALESCE(p_trip_data->>'currency', 'KRW')
    ) RETURNING id INTO new_trip_id;

    RETURN new_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE public.trips IS '여행 프로젝트 메타 정보';
COMMENT ON TABLE public.places IS '일차별 방문 장소 데이터';
COMMENT ON TABLE public.hotels IS '일차별 숙소 데이터';
COMMENT ON TABLE public.flights IS '항공편 정보 (출국/귀국)';
COMMENT ON TABLE public.expenses IS '여행 경비 내역';
COMMENT ON TABLE public.shared_trips IS '공유 링크 관리';
COMMENT ON TABLE public.backup_mappings IS '기기 간 동기화 백업 코드';
