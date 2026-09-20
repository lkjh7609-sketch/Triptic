# 03. 데이터 모델

> 기존 `supabase/schema.sql`의 RLS 설계 철학(소유자/공유 분리, `SECURITY DEFINER` 함수 내 자체 검증)을 그대로 계승한다.
> 가장 큰 변화는 **`trips.snapshot` JSONB → 정규화 테이블**이다. 근거는 [`../DEVELOPMENT_PLAN.md` ADR-002](../DEVELOPMENT_PLAN.md).

---

## 1. 설계 원칙

1. **모든 테이블에 RLS를 켠다.** 예외 없음. 정책 없는 테이블은 배포 금지.
2. **소프트 삭제**: 사용자 콘텐츠는 `deleted_at`으로 지우고, 30일 뒤 하드 삭제한다.
3. **타임스탬프는 `timestamptz`**. 사용자에게 보여줄 현지 시각은 `*_local` + `*_tz`를 따로 저장한다 (항공편 필수).
4. **금액은 `numeric(14,2)`**. `float` 금지.
5. **Zod 스키마가 단일 진실 공급원**이다. TS 타입은 `z.infer`로 뽑고, 서버·클라이언트가 같은 스키마로 검증한다.

---

## 2. 도메인 타입 (TypeScript / Zod)

`src/types/domain.ts`

```ts
import { z } from 'zod';

export const Locale = z.enum(['ko', 'en', 'zh-CN']);
export const Currency = z.enum(['KRW','JPY','USD','EUR','CNY','TWD','THB','VND','GBP','AUD']);

export const ItemType = z.enum([
  'place',      // 관광지·명소
  'meal',       // 식사
  'lodging',    // 숙소 체크인/아웃
  'transport',  // 지상 이동 (기차·버스·렌터카)
  'flight',     // 항공
  'activity',   // 투어·액티비티
  'note',       // 좌표 없는 메모
]);

export const BookingType = z.enum([
  'flight','lodging','rail','car_rental','activity','restaurant','insurance','other',
]);

export const GeoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const ItineraryItem = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  dayId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: ItemType,
  title: z.string().min(1).max(200),
  subtitle: z.string().max(200).nullable(),   // "4성급 호텔", "일본라면 전문식당"
  category: z.string().max(64).nullable(),    // Places type에서 추론
  googlePlaceId: z.string().nullable(),
  location: GeoPoint.nullable(),              // note 타입만 null 허용
  address: z.string().nullable(),
  countryCode: z.string().length(2).nullable(),
  /** 현지 시각 — 사용자에게 보여주는 값 */
  startLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
  endLocal:   z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable(),
  /** IANA 타임존. 예: 'Asia/Tokyo' */
  timezone: z.string().nullable(),
  /** 정렬·알림용 절대 시각 (startLocal + timezone에서 파생) */
  startAt: z.string().datetime().nullable(),
  memo: z.string().max(1000).nullable(),
  estimatedCost: z.number().nonnegative().nullable(),
  bookingId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ItineraryItem = z.infer<typeof ItineraryItem>;

export const Leg = z.object({
  id: z.string().uuid(),
  tripId: z.string().uuid(),
  fromItemId: z.string().uuid(),
  toItemId: z.string().uuid(),
  mode: z.enum(['transit','driving','walking','bicycling','flight','unknown']),
  distanceM: z.number().int().nonnegative().nullable(),
  durationS: z.number().int().nonnegative().nullable(),
  /** 실패 시 Haversine 직선거리를 쓰고 이 값을 true로 둔다 → UI에 '≈' 표시 */
  isEstimate: z.boolean(),
  encodedPolyline: z.string().nullable(),
  provider: z.enum(['google_directions','haversine']),
  fetchedAt: z.string().datetime(),
});
export type Leg = z.infer<typeof Leg>;
```

> `startLocal`을 문자열로 두는 이유: 항공권에 인쇄된 "08:00"은 **출발지 현지 시각**이다. 이를 `Date`로 바로 파싱하면 기기 타임존이 섞여 들어가 반드시 틀어진다. 현지 시각 문자열 + IANA 타임존을 원본으로 저장하고, `startAt`(UTC)은 파생값으로만 쓴다.

---

## 3. Postgres 스키마

### 3.1 사용자

```sql
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null default '',
  avatar_url    text,
  bio           text check (char_length(bio) <= 200),
  locale        text not null default 'ko' check (locale in ('ko','en','zh-CN')),
  temp_unit     text not null default 'c'  check (temp_unit in ('c','f')),
  distance_unit text not null default 'km' check (distance_unit in ('km','mi')),
  base_currency text not null default 'KRW',
  home_country  char(2),
  stats_public  boolean not null default true,
  -- 계정 삭제 유예 (설정 > 계정 삭제)
  deletion_requested_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

### 3.2 여행

```sql
create table public.trips (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 100),
  cover_url     text,
  start_date    date not null,
  end_date      date not null check (end_date >= start_date),
  base_currency text not null default 'KRW',
  status        text not null default 'planning'
                check (status in ('planning','ongoing','completed','archived')),
  -- ⚠️ 레거시: 2.x 스냅샷. 이관 검증 완료 후 제거 (§6)
  snapshot      jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
create index on public.trips (owner_id, start_date desc) where deleted_at is null;

-- 동행자 (기존 '공유 링크'와 별개로, 편집 권한을 가진 멤버)
create table public.trip_members (
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null check (role in ('owner','editor','viewer')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.trip_days (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references public.trips(id) on delete cascade,
  day_index int  not null check (day_index >= 1),
  date      date not null,
  city_name text,
  city_lat  double precision,
  city_lng  double precision,
  timezone  text,                          -- 그 날의 기준 타임존
  note      text,
  unique (trip_id, day_index)
);

create table public.itinerary_items (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  day_id          uuid not null references public.trip_days(id) on delete cascade,
  position        int  not null,
  type            text not null check (type in
                    ('place','meal','lodging','transport','flight','activity','note')),
  title           text not null,
  subtitle        text,
  category        text,
  google_place_id text,
  lat             double precision,
  lng             double precision,
  address         text,
  country_code    char(2),
  start_local     text check (start_local ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  end_local       text check (end_local   ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  timezone        text,
  start_at        timestamptz,
  memo            text,
  estimated_cost  numeric(14,2),
  -- ⚠️ bookings는 아래(§3.3)에서 생성되므로 여기서 바로 참조할 수 없다.
  --    컬럼만 만들고 외래키는 §3.3 뒤에서 alter table로 추가한다.
  booking_id      uuid,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- note를 제외한 모든 항목은 좌표가 있어야 한다 (지도에 그려야 하므로)
  constraint coords_required check (type = 'note' or (lat is not null and lng is not null))
);
create index on public.itinerary_items (trip_id, day_id, position);
create index on public.itinerary_items (trip_id, start_at);
```

> **`position` 재정렬 전략**: 정수 시퀀스를 매번 다시 매기면 드래그 한 번에 N행이 업데이트된다. `position`을 `numeric`으로 두고 두 항목 사이에 삽입할 때 중간값을 쓰는 방식(fractional indexing)도 가능하다. **3.0에서는 정수 + 일괄 재정렬로 시작한다** — 하루 항목 수가 보통 10개 미만이라 비용이 미미하고 단순하다. 항목이 50개를 넘는 사용자가 관측되면 그때 전환한다.

```sql
create table public.legs (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  from_item_id     uuid not null references public.itinerary_items(id) on delete cascade,
  to_item_id       uuid not null references public.itinerary_items(id) on delete cascade,
  mode             text not null default 'transit',
  distance_m       int,
  duration_s       int,
  is_estimate      boolean not null default false,
  encoded_polyline text,
  provider         text not null default 'google_directions',
  fetched_at       timestamptz not null default now(),
  unique (from_item_id, to_item_id, mode)
);
-- 30일 지난 경로 캐시는 정리 (요금·경로가 바뀔 수 있음)
create index on public.legs (fetched_at);
```

### 3.3 예약 · 문서 (바우처)

```sql
create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid references public.trips(id) on delete cascade,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  storage_path   text not null,            -- Storage 'vouchers' 비공개 버킷 경로
  original_name  text not null,
  mime_type      text not null,
  size_bytes     bigint not null check (size_bytes <= 20 * 1024 * 1024),
  page_count     int,
  parse_status   text not null default 'pending'
                 check (parse_status in ('pending','processing','parsed','failed','skipped')),
  parse_error    text,
  -- 개인정보: 원문 텍스트는 절대 저장하지 않는다. 마스킹 결과의 해시만 남겨 중복 업로드를 감지한다.
  content_hash   text,
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);
create unique index on public.documents (owner_id, content_hash) where content_hash is not null and deleted_at is null;

create table public.bookings (
  id                 uuid primary key default gen_random_uuid(),
  trip_id            uuid not null references public.trips(id) on delete cascade,
  document_id        uuid references public.documents(id) on delete set null,
  type               text not null check (type in
                       ('flight','lodging','rail','car_rental','activity','restaurant','insurance','other')),
  provider           text,                  -- 'Korean Air', 'Agoda' 등
  reference_code     text,                  -- PNR / 예약번호
  /** 파싱된 구조화 데이터. 타입별 스키마는 04-document-ai.md */
  parsed             jsonb not null default '{}'::jsonb,
  /** 필드별 신뢰도 0~1 */
  confidence         jsonb not null default '{}'::jsonb,
  /** 사용자가 검수 시트에서 확정했는가 — false면 일정에 반영하지 않는다 */
  confirmed_by_user  boolean not null default false,
  parser_version     text,                  -- 재파싱 필요 여부 판단용
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on public.bookings (trip_id, type);
```

### 3.3.1 전방 참조 해소

`itinerary_items.booking_id`의 외래키는 `bookings` 생성 이후에 붙인다.
**마이그레이션 파일에서의 생성 순서**: `profiles → trips → trip_members → trip_days → documents → bookings → itinerary_items → (alter) → legs → expenses`

```sql
alter table public.itinerary_items
  add constraint itinerary_items_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete set null;
```

### 3.4 경비

```sql
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  day_id       uuid references public.trip_days(id) on delete set null,
  item_id      uuid references public.itinerary_items(id) on delete set null,
  category     text not null check (category in
                 ('food','transport','lodging','shopping','activity','other')),
  description  text not null,
  amount       numeric(14,2) not null check (amount >= 0),
  currency     text not null,
  /** 입력 시점 환율 스냅샷. 나중에 환율이 변해도 기록은 고정된다 */
  fx_rate_to_base numeric(18,8),
  payment_method  text check (payment_method in ('cash','card','other')),
  paid_by      uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
```

### 3.5 날씨 캐시

```sql
-- grid_key = round(lat,2)||','||round(lng,2)  (약 1.1km 격자 → 캐시 적중률 극대화)
create table public.weather_cache (
  grid_key   text not null,
  date       date not null,
  provider   text not null default 'weatherkit',
  payload    jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (grid_key, date, provider)
);
create index on public.weather_cache (fetched_at);

-- 예보 범위(약 10일)를 넘는 날짜용 기후 평년값
create table public.climate_normals (
  grid_key   text not null,
  month      int  not null check (month between 1 and 12),
  tmin_c     numeric(4,1),
  tmax_c     numeric(4,1),
  precip_mm  numeric(6,1),
  source     text not null,
  primary key (grid_key, month)
);
```

### 3.6 커뮤니티

→ 테이블 정의와 정책은 [`06-community.md` §3](06-community.md)에 있다 (모더레이션과 함께 봐야 이해되므로 그쪽에 모았다).

### 3.7 기존 테이블 유지

`shared_trips`, `suggestions`는 **그대로 유지**한다. 링크 공유와 동행자 제안은 이미 잘 동작하고 RLS도 검증되어 있다. `trip_members`(신규)는 권한 기반 협업용이고, `shared_trips`는 로그인 없는 링크 공유용으로 역할이 다르다.

---

## 4. RLS 정책

### 4.1 헬퍼 함수

```sql
-- 이 사용자가 해당 여행에 접근할 수 있는가 (소유자 또는 멤버)
create or replace function public.can_access_trip(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.deleted_at is null
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.trip_members m
                      where m.trip_id = t.id and m.user_id = auth.uid()))
  );
$fn$;

create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id
      and t.deleted_at is null
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.trip_members m
                      where m.trip_id = t.id and m.user_id = auth.uid()
                        and m.role in ('owner','editor')))
  );
$fn$;
```

### 4.2 정책 예시 (모든 여행 하위 테이블에 동일 패턴)

```sql
alter table public.itinerary_items enable row level security;

create policy "read items of accessible trips"
  on public.itinerary_items for select
  using (public.can_access_trip(trip_id));

create policy "write items of editable trips"
  on public.itinerary_items for insert
  with check (public.can_edit_trip(trip_id));

create policy "update items of editable trips"
  on public.itinerary_items for update
  using (public.can_edit_trip(trip_id));

create policy "delete items of editable trips"
  on public.itinerary_items for delete
  using (public.can_edit_trip(trip_id));
```

동일 패턴을 `trip_days`, `legs`, `bookings`, `expenses`에 적용한다.

### 4.3 문서(바우처) — 더 엄격하게

```sql
alter table public.documents enable row level security;

-- 바우처에는 여권번호 등이 들어 있다. 동행자에게도 기본 비공개, 소유자만 접근.
create policy "owner only" on public.documents for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
```

**Storage 버킷 정책** (`vouchers`, public = false):

```sql
create policy "voucher read own"
  on storage.objects for select
  using (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "voucher write own"
  on storage.objects for insert
  with check (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);
```

경로 규칙: `vouchers/{user_id}/{trip_id}/{document_id}.{ext}`
클라이언트는 항상 **서명 URL(유효기간 5분)**로만 접근한다.

### 4.4 공유 링크 (기존 설계 계승)

기존 `get_shared_trip(share_code)`를 정규화 테이블용으로 다시 쓴다. **기존 코드의 좋은 점 — 함수 안에서 만료·존재를 직접 검증하는 것 — 을 반드시 유지한다.**

```sql
create or replace function public.get_shared_trip(p_share_code text)
returns json
language plpgsql security definer
set search_path = public, pg_temp
as $fn$
declare v_trip_id uuid; result json;
begin
  select st.trip_id into v_trip_id
  from public.shared_trips st
  join public.trips t on t.id = st.trip_id and t.deleted_at is null
  where st.share_code = p_share_code
    and (st.expires_at is null or st.expires_at > now())
  order by st.created_at desc limit 1;

  if v_trip_id is null then return null; end if;

  select json_build_object(
    'trip',  (select row_to_json(x) from (
                select id, title, start_date, end_date, base_currency
                from public.trips where id = v_trip_id) x),
    'days',  (select coalesce(json_agg(d order by d.day_index), '[]'::json)
                from public.trip_days d where d.trip_id = v_trip_id),
    'items', (select coalesce(json_agg(i order by i.position), '[]'::json)
                from public.itinerary_items i where i.trip_id = v_trip_id),
    'legs',  (select coalesce(json_agg(l), '[]'::json)
                from public.legs l where l.trip_id = v_trip_id)
  ) into result;

  update public.shared_trips
     set view_count = view_count + 1, last_viewed_at = now()
   where share_code = p_share_code;

  return result;
end;
$fn$;

revoke all on function public.get_shared_trip(text) from public;
grant execute on function public.get_shared_trip(text) to anon, authenticated;
```

> ⚠️ **공유 응답에 `bookings`·`documents`를 절대 포함하지 말 것.** 링크를 가진 누구나 여권번호를 보게 된다.

---

## 5. 집계 RPC (대시보드)

```sql
create or replace function public.get_user_travel_stats()
returns json
language sql stable security invoker   -- ⚠️ invoker: RLS를 그대로 통과시켜 남의 데이터가 섞이지 않게 한다
set search_path = public, pg_temp
as $fn$
  with my_trips as (
    select * from public.trips
    where owner_id = auth.uid() and deleted_at is null
  ),
  done as (select * from my_trips where end_date < current_date),
  days as (
    select distinct d.date
    from public.trip_days d join done t on t.id = d.trip_id
  )
  select json_build_object(
    'tripCount',    (select count(*) from done),
    'countryCount', (select count(distinct i.country_code)
                       from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.country_code is not null),
    'cityCount',    (select count(distinct d.city_name)
                       from public.trip_days d join done t on t.id = d.trip_id
                      where d.city_name is not null),
    'dayCount',     (select count(*) from days),
    'placeCount',   (select count(*) from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.type in ('place','meal','activity')),
    'groundMeters', (select coalesce(sum(l.distance_m), 0)
                       from public.legs l join done t on t.id = l.trip_id
                      where l.mode <> 'flight'),
    'countries',    (select coalesce(json_agg(distinct i.country_code), '[]'::json)
                       from public.itinerary_items i join done t on t.id = i.trip_id
                      where i.country_code is not null)
  );
$fn$;
```

> `security invoker`를 쓴 이유: `definer`로 만들면 RLS를 우회하므로 `auth.uid()` 조건을 한 군데라도 빠뜨리면 전체 사용자 데이터가 새어 나간다. 기존 스키마 주석에도 같은 취지의 교훈(`get_trip_full_data` 취약점)이 기록되어 있다.

---

## 6. 마이그레이션 계획 (`snapshot` → 정규화)

**이 작업은 사용자 데이터를 잃을 수 있는 가장 위험한 단계다.** 아래 순서를 반드시 지킨다.

### 6.1 단계

| 단계 | 내용 | 롤백 |
|---|---|---|
| M0 | 전체 DB 백업 + `trips` CSV 덤프를 별도 스토리지에 보관 | — |
| M1 | 신규 테이블 생성 (기존 테이블 미변경) | 테이블 drop |
| M2 | 변환 함수 `migrate_trip_snapshot(trip_id)` 배포 + **내부 계정에서만** 실행 | 신규 행 삭제 |
| M3 | 검증: 행 수·날짜·좌표 체크섬 비교 (§6.3) | — |
| M4 | 전체 사용자 배치 실행 (100건씩, 실패 시 중단) | `snapshot`이 그대로 있으므로 재실행 가능 |
| M5 | 앱 배포 — **dual-write**: 신규 앱은 정규화 테이블에 쓰고 `snapshot`도 같이 갱신 | 구버전 앱 계속 동작 |
| M6 | 2주 관찰 후 dual-write 해제 | |
| M7 | `snapshot` 컬럼 drop | **불가역** — M6까지 문제 없을 때만 |

### 6.2 변환 규칙

| 기존 (`snapshot`) | 신규 |
|---|---|
| `data[day][i]` | `itinerary_items` (`day_index=day`, `position=i`, `type='place'`) |
| `hotels[day]` | `itinerary_items` (`type='lodging'`) — 그날 첫 항목 앞 |
| `meals[day][slot]` | `itinerary_items` (`type='meal'`, `subtitle=MEAL_META[slot].label`) |
| `flights.outbound/return` | `bookings` (`type='flight'`, `confirmed_by_user=true`) + `itinerary_items` (`type='flight'`) |
| `expenses[day][]` | `expenses` |
| `dayCities[day]` | `trip_days.city_name/lat/lng` |
| `currency` | `trips.base_currency` |

**주의점**
- 기존 항목에는 `id`가 없다 (배열 인덱스로만 식별). 신규 `uuid`를 생성한다.
- 기존 `time`은 `"13:00"` 형식이다. `trip_days.date`와 합쳐 `start_local`을 만든다.
- `timezone`은 좌표로 역조회한다 (번들 공항 DB + `tz-lookup` 라이브러리). 실패하면 여행 기준 타임존을 쓴다.
- 좌표가 없는 항목은 기존 앱의 `saveData()`(index.html:4505)가 **저장 시점에 영구 삭제**한다. 따라서 `snapshot`에는 사실상 남아 있지 않지만, 방어적으로 발견되면 **`type='note'`로 보존**한다 (임의 삭제 금지).

### 6.3 검증 쿼리 (M3에서 반드시 실행)

```sql
-- 여행별 항목 수 비교: 기존 snapshot vs 신규 테이블
select t.id, t.title,
       (select count(*) from jsonb_each(t.snapshot->'data') d,
               jsonb_array_elements(d.value) e) as snapshot_places,
       (select count(*) from public.itinerary_items i
         where i.trip_id = t.id and i.type = 'place') as migrated_places
from public.trips t
where t.snapshot is not null
  and (select count(*) from jsonb_each(t.snapshot->'data') d,
               jsonb_array_elements(d.value) e)
   <> (select count(*) from public.itinerary_items i
        where i.trip_id = t.id and i.type = 'place');
-- ⬆ 결과가 0행이어야 M4로 진행한다
```

추가 검증: 좌표 합계 체크섬, 날짜 범위 일치, 경비 합계 일치.

### 6.4 로컬 데이터 (localStorage)

기존 앱은 비로그인 사용자의 여행을 `localStorage['smartPlannerAllProjects']`에 저장한다. 신규 앱 첫 실행 시:

1. 해당 키를 읽어 IndexedDB로 이관
2. 로그인하면 "기기에 저장된 여행 N개를 계정에 올릴까요?" 안내 후 업로드
3. 이관 성공이 확인되기 전에는 `localStorage`를 **지우지 않는다**

---

## 7. 인덱스 요약

```sql
create index on public.itinerary_items (trip_id, day_id, position);
create index on public.itinerary_items (trip_id, start_at);
create index on public.itinerary_items (country_code) where country_code is not null;
create index on public.trips (owner_id, start_date desc) where deleted_at is null;
create index on public.legs (trip_id);
create index on public.legs (fetched_at);
create index on public.bookings (trip_id, type);
create index on public.documents (trip_id) where deleted_at is null;
create index on public.expenses (trip_id, day_id);
create index on public.weather_cache (fetched_at);
```

---

## 8. 데이터 보존 정책

| 데이터 | 보존 |
|---|---|
| 삭제한 여행 | 30일 후 하드 삭제 |
| 삭제한 바우처 파일 | 즉시 Storage에서 삭제 (DB 행은 30일) |
| 계정 삭제 요청 | 30일 유예 후 `auth.users` 포함 완전 삭제 |
| 경로 캐시 (`legs`) | 30일 후 재조회 |
| 날씨 캐시 | 현재 날씨 1시간, 예보 3시간, 과거 영구 |
| 파싱 원문 텍스트 | **저장하지 않음** (해시만) |
| 분석 이벤트 | 12개월 |
| 사용량 계측 (`usage_events`) | 원본 90일 → 월별 집계로 롤업 후 영구 |

정리 작업은 Supabase `pg_cron`으로 매일 03:00 KST에 실행한다.

---

## 9. 사용량 계측 (`usage_events`)

> **3.0에 과금은 없지만 계측은 넣는다.** 이유는 [`../DEVELOPMENT_PLAN.md` §13.3](../DEVELOPMENT_PLAN.md) 참고 — 나중에 가격을 정할 근거이자, 지금 당장은 남용 방어의 기준이 된다. 출시 후에 붙이면 그 사이 데이터를 통째로 잃는다.

```sql
create table public.usage_events (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- 'document.parse' | 'trip.create' | 'ai.recommend' | 'directions.fetch'
  -- | 'voucher.upload' | 'weather.fetch' | 'limit.reached'
  kind       text not null,
  -- 비용 환산용 수량 (파싱 페이지 수, 업로드 바이트 등). 단순 카운트면 1
  quantity   numeric(12,2) not null default 1,
  -- 과금 단위 후보를 미리 붙여 둔다 (여행별 청구 모델 검토용)
  trip_id    uuid references public.trips(id) on delete set null,
  -- ⚠️ 개인정보·문서 내용을 절대 넣지 않는다. 식별 불가능한 메타데이터만.
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.usage_events (user_id, kind, created_at desc);
create index on public.usage_events (created_at);
create index on public.usage_events (trip_id) where trip_id is not null;

alter table public.usage_events enable row level security;

-- 사용자는 자기 사용량만 읽을 수 있다 (설정 화면에서 "이번 달 사용량" 표시용)
create policy "read own usage" on public.usage_events
  for select using (user_id = auth.uid());

-- 쓰기는 서버(Edge Function / service_role)만. 클라이언트가 직접 기록하면
-- 한도를 우회할 수 있다.
revoke insert, update, delete on public.usage_events from authenticated, anon;
```

### 9.1 한도 확인 함수

```sql
-- 최근 24시간 사용량. 남용 방어 한도 판정에 쓴다.
create or replace function public.usage_in_window(
  p_user_id uuid, p_kind text, p_window interval)
returns numeric
language sql stable security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(sum(quantity), 0)
  from public.usage_events
  where user_id = p_user_id
    and kind = p_kind
    and created_at > now() - p_window;
$fn$;
```

### 9.2 기록 지점

| 이벤트 | 기록 위치 | quantity |
|---|---|---|
| `document.parse` | `parse-booking` Edge Function 시작 시 | 페이지 수 |
| `voucher.upload` | Storage 업로드 완료 후 | 바이트 |
| `ai.recommend` | `api/recommend` | 1 |
| `directions.fetch` | 경로 캐시 미스로 실제 호출했을 때만 | 구간 수 |
| `trip.create` | 여행 생성 | 1 |
| `limit.reached` | 한도 초과로 거절했을 때 | 1 |

> `directions.fetch`를 **캐시 미스일 때만** 기록하는 것이 중요하다. 캐시 적중까지 세면 실제 비용과 무관한 숫자가 되어, 나중에 가격을 정할 때 잘못된 결론으로 이어진다.

### 9.3 반드시 지킬 것

- **개인정보를 넣지 않는다.** `meta`에 문서 내용·파일명·장소명·좌표를 담지 않는다. 담아도 되는 것은 `{"parser":"flight/korean-air","status":"ok"}` 수준이다.
- **클라이언트가 직접 쓰지 않는다.** 서버에서만 기록한다.
- **한도 초과도 기록한다.** 정상 사용자가 한도에 걸리는지 확인하는 유일한 방법이다. 걸린다면 한도가 잘못된 것이므로 올린다.
