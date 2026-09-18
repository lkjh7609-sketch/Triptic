# Triptic 코드 리뷰 보고서

> **리뷰 일자**: 2026-09-18
> **리뷰 대상**: `main` 브랜치 (`0625504`)
> **리뷰 범위**: `index.html`, `api/`, `src/`, `supabase/schema.sql`, `sw.js`, 빌드/CI 설정
> **리뷰어**: 시니어 아키텍트 관점 정적 분석 + 테스트/린트/타입체크 실측

---

## 0. 조치 현황 (2026-09-18, `fix/code-review-2026-09-18` 브랜치)

이 리뷰 직후 사용자 요청("Firebase는 전혀 안 씀, 전부 Supabase로 세팅했으니 지우고 모듈화 진행")에 따라 아래 항목을 실제로 수정했습니다. 최종 검증: `npx jest`(47/47 통과) · `npx tsc --noEmit`(오류 0) · `npx eslint`(오류 0, 경고 5) · `npm run build`(성공).

| 항목 | 상태 | 비고 |
|---|---|---|
| **H-1** Firebase RTDB 무인증 노출 | ⚠️ **코드는 대체 완료, 콘솔 조치 필요** | Firebase 호출 전량을 Supabase(RLS 적용)로 이관함(아래 "Firebase → Supabase 이관" 참고). 기존 Firebase 프로젝트 자체는 더 이상 앱이 쓰지 않지만, 콘솔에서 프로젝트를 삭제하거나 규칙을 잠그는 것은 사용자가 직접 해야 함 |
| **H-2** AviationStack 키 하드코딩 | ✅ 수정 | `api/flight.js` 신설(서버 전용 프록시), `index.html`/`vite.config.js`에서 키 제거. **Git 히스토리에 남은 키는 별도로 재발급 필요** |
| **H-3** `SECURITY DEFINER` RLS 우회 | ✅ 수정 | `get_trip_full_data`에 소유권 검증 추가, `search_path` 고정, `anon` 실행 권한 회수. 신규 `get_shared_trip`도 동일 원칙 적용 |
| **H-4** `/api/env` 전면 공개 CORS + 서버 전용 키 노출 | ✅ 수정 | `AVIATIONSTACK_API_KEY` 제거, Origin 화이트리스트 적용 |
| **H-5** `/api/recommend` 무인증·무제한 | ✅ 수정 | Origin 제한, IP 레이트리밋(20회/분), 입력 정규화(제어문자 제거·길이 제한) |
| **H-6** `src/`가 죽은 코드 | ✅ 대부분 해결 | `index.html`에 `<script type="module" src="/src/main.js">` 연결. 데이터 계층(Supabase 저장/공유/제안)은 완전히 모듈화되어 실제로 사용됨. **단, UI 렌더링 로직(`renderList`/`generateSchedule`/`exportToPDF` 등)은 여전히 인라인 스크립트에 있음 — 전체 UI 모듈화는 별도의 대규모 작업으로 남겨둠** |
| **H-7** CI가 항상 통과 | ✅ 수정 | 4개 잡 전부 `continue-on-error`/`|| echo` 제거. 실제로 실패하면 CI가 빨간불이 됨 |
| **M-1** `addMinutes` 버그 + 실패 테스트 3건 | ✅ 수정 | `timeUtils.js` 음수 처리 수정, `appState.js`의 `totalTripDays`→`totalDays` getter 이름 통일, 테스트 로직 수정. 47/47 통과 |
| **M-2** `authService.js` 크래시 버그 | ✅ 수정 | `client` 미정의 참조, `onAuthStateChanged`(오타) 수정. 다른 Supabase 프로젝트를 가리키던 하드코딩 폴백 제거 |
| **M-3** `showToast` innerHTML 싱크 | ✅ 수정 | 기본값을 `textContent`로 전환 (모든 기존 호출부가 HTML을 쓰지 않음을 확인 후 안전하게 전환) |
| **M-4** `Math.random()` 기반 공유 ID | ✅ 수정 | `crypto.getRandomValues` 기반 `generateShortId`로 전환(`src/utils/id.js`), 공유 코드는 Supabase가 서버에서 관리 |
| **M-5** 삭제된 여행이 백업에서 부활 | ✅ 해소 | 디바운스된 Firebase 백업 자체를 제거하고 Supabase 직접 삭제(즉시 반영)로 대체 — 경쟁 조건의 근본 원인이 없어짐 |
| **M-6** 가져오기 시 무조건 덮어쓰기 | ✅ 수정 | 이름 충돌 시 [덮어쓰기]/[둘 다 보관] 선택 모달 추가 |
| **M-7** SW가 API 응답 무제한 캐시 | ✅ 수정 | 지도 타일·`access_key`/`key` 쿼리 포함 요청은 캐시 제외, Firebase 대신 Supabase만 캐시 대상 |
| **M-8** SRI 부재 + 보안 헤더 없음 | 🟡 부분 수정 | `vercel.json`에 보안 헤더 + CSP(Report-Only) 추가. **SRI 해시는 미적용** (인라인 스크립트 비중이 커서 CSP를 강제 모드로 켤 수 없어 우선순위를 낮춤) |
| **M-9** 서버리스 타임아웃으로 폴백 도달 불가 | ✅ 수정 | 전체 요청에 8초 예산 도입, 각 제공자가 남은 시간만 사용하도록 수정 — 큐레이션 폴백에 항상 도달 |
| **M-10** 지도 마커 전량 재생성 | ⏭️ 보류 | 지도 렌더링 로직은 브라우저로 시각 검증이 불가능한 상태에서 손대기엔 회귀 위험이 커서 이번 범위에서 제외 |
| **L-1** `index.html` 3중 복제 | ✅ 수정 | `scripts/build.js`를 `npm run build`/`dev`에 연결, `public/index.html`(Vite가 직접 빌드하므로 불필요) 삭제, `.gitignore` 정리 |
| **L-2** `exportToPDF` 570줄 함수 | ⏭️ 보류 | 시각 검증 불가 상태에서 핵심 기능(PDF 내보내기) 리팩터링은 위험도가 높아 제외 |
| **L-3** `.js`/`.ts` 유틸 이중 관리 | ✅ 수정 | `.ts` 버전 삭제, `.js`를 단일 소스로 통일(개선사항은 `.js`로 포팅) |
| **L-4** ESLint 오류 11건 | ✅ 수정 | 0건으로 감소 (죽은 파일 삭제로 다수 해결 + 나머지 직접 수정) |
| **L-5** 인라인 `onclick` 97개 | ⏭️ 보류 | 이벤트 위임 전환은 기계적이지만 손이 많이 가고 이번 범위(Firebase 제거·모듈화 기반 작업)와 별개 과제로 판단 |
| **L-6** 기타 (RLS 정책 누락 등) | ✅ 수정 | `user_profiles` INSERT 정책, `shared_trips` UPDATE/DELETE 정책 추가. `viewport user-scalable=no`와 빈 `renderMapMarkers()`는 기존 의도된 제스처 제어 로직과 얽혀 있어 보류 |

### Firebase → Supabase 완전 이관 (사용자 요청, 원 리뷰 범위 밖 추가 작업)

기존에는 로그인만 Supabase, 실제 데이터(백업 코드 동기화·공유 링크·동행자 제안)는 전부 인증 없는 Firebase Realtime Database REST였습니다. 이번 작업으로:

- **`supabase/schema.sql`**: `trips.snapshot`(JSONB) 컬럼을 신설해 기존 Firebase 페이로드와 동일한 구조로 저장(관계형 전면 분해는 라이브 DB에 대한 검증 수단이 없는 상태에서 무리하게 진행하지 않음). `suggestions` 테이블 신규 추가, `shared_trips` 기반 RLS로 "공유 중인 여행만 익명 열람 가능"을 구현.
- **`src/services/supabaseClient.js`** (신규): 앱 전체가 공유하는 Supabase 클라이언트 싱글톤.
- **`src/services/supabaseService.js`**: `saveTrip`/`deleteTrip`/`listTrips`/`createShareLink`/`revokeShareLinks`/`getSharedTripByCode`/`addSuggestion`/`listSuggestions`/`deleteSuggestion` 구현.
- **`index.html`**: 기기 백업 코드 기능 전체 제거(로그인 기반 자동 동기화로 대체), 공유 링크·동행자 제안 기능을 Supabase 호출로 전면 교체. `FIREBASE_DB_URL` 등 Firebase 관련 코드 0건.
- **`sw.js`**: Firebase 캐싱 로직 제거, Supabase로 교체.

✅ **DB 마이그레이션 완료 및 검증됨** — 사용자가 Supabase SQL Editor에서 `supabase/schema.sql`을 직접 적용했고, 로컬(`npm run dev`, 실제 Vercel 환경변수 연결)에서 로그인 → 여행 생성 → 공유 링크 → 동행자 제안까지 실제 흐름을 테스트해 정상 동작을 확인함. anon REST 호출(`trips`/`shared_trips`/`suggestions` 조회, `get_shared_trip` RPC)로 RLS도 별도 검증함.

✅ **PR 생성 및 CI 워크플로 반영 완료** — `fix/code-review-2026-09-18` 브랜치로 PR 생성됨. `.github/workflows/main.yml`의 `continue-on-error`/`|| echo` 폴백은 GitHub 웹 에디터에서 직접 제거되어 브랜치에 반영됨(로컬 PAT에 `workflow` 스코프가 없어 CLI 푸시로는 불가했음).

---

## 1. 상위 수준 요약

Triptic은 여행 일정을 일차별로 계획하고 지도·항공편·경비·PDF 내보내기를 지원하는 한국어 PWA이며, 실제 실행 코드는 **8,209줄짜리 단일 `index.html`** (CSS 2,865줄 + 인라인 스크립트 5,034줄)에 전부 들어 있습니다.

데이터 저장은 **localStorage를 1차 저장소**로 쓰고, 기기 간 동기화·공유 링크는 **인증 없는 Firebase Realtime Database REST**로, 로그인만 **Supabase OAuth(Google/Kakao)**로 처리하는 3중 구조입니다.

`src/` 디렉터리에는 모듈화된 서비스·상태관리·유틸리티·테스트가 잘 갖춰져 있으나, **`index.html`이 이를 전혀 import 하지 않아 현재는 전량 죽은 코드**이며, 이 이중 구조가 이 코드베이스 문제의 절반가량을 만들어내고 있습니다.

---

## 2. 장점 및 모범 사례

유지해야 할 좋은 패턴이 분명히 존재합니다.

| # | 항목 | 근거 |
|---|---|---|
| ✅ 1 | **XSS 이스케이프의 일관된 적용** | `escapeHtml()` (index.html:3811)이 렌더링 경로 전반에 체계적으로 적용됨. 특히 AI 추천 카드(6664~6700), 메모(5605), 도시명(4819), 프로젝트명(4433)까지 외부 입력이 닿는 대부분 지점을 커버 — 바닐라 JS 프로젝트에서 보기 드문 수준 |
| ✅ 2 | **AI 추천의 다단계 폴백 설계** | `api/recommend.js`가 Gemini → Groq → OpenRouter → 큐레이션 폴백(223~529)까지 4단계로 내려가 **API 키가 없거나 쿼터가 초과돼도 사용자는 절대 빈 화면을 보지 않음**. 무료 티어 서비스의 현실적인 제약을 정면으로 해결한 설계 |
| ✅ 3 | **저장소 용량 방어** | `saveAllProjects()` (4534)가 4.5MB 임계값에서 선제 경고하고 `QuotaExceededError`를 분기 처리(4556). localStorage 한계를 인지하고 대비한 흔치 않은 사례 |
| ✅ 4 | **Directions API 결과 캐싱** | `directionsCache` (7060)로 좌표쌍 기반 캐시 키를 만들어 과금되는 경로 탐색 중복 호출을 억제 |
| ✅ 5 | **Service Worker의 전략 분리** | 내비게이션=network-first, 정적자산=cache-first, Maps 부트스트랩 스크립트=캐시 우회(sw.js:159)로 명확히 분리. `Promise.allSettled` 기반 복원력 있는 프리캐시(98) |
| ✅ 6 | **RLS 기본기** | `supabase/schema.sql:125~132`에서 8개 테이블 전부 RLS를 활성화하고 소유권 기반 정책을 작성 — 기본 방향은 옳음 |
| ✅ 7 | **`src/` 모듈 계층의 설계 품질** | `TripticState`의 구독/해제 반환 패턴(appState.js:125~139), `StorageService`의 정적 메서드 캡슐화, JSDoc 주석 밀도는 실제로 훌륭함. **살려야 할 자산** |

---

## 3. 주요 문제점 및 개선 제안

### 🔴 HIGH (즉시 조치)

---

#### H-1. Firebase Realtime DB가 인증 없이 전면 공개 — 전체 사용자 데이터 열람·변조·삭제 가능

**근거**: `index.html:3545`, `4037`, `4096`, `7118`, `7165`, `7401`

DB URL이 소스에 노출된 상태에서 모든 접근이 **인증 토큰 없는 순수 REST 호출**입니다.

```js
// index.html:3545
const FIREBASE_DB_URL = "https://ben-s-travel-planner-default-rtdb.asia-southeast1.firebasedatabase.app";

// index.html:4096 — 인증 헤더 없음
const res = await fetch(`${FIREBASE_DB_URL}/shares/backup_${backupId}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload)   // ← 사용자의 전체 여행 데이터
});

// index.html:7165 — 삭제도 무인증
await fetch(`${FIREBASE_DB_URL}/shares/${shareId}.json`, { method: 'DELETE' });
```

**공격 시나리오**: 공격자가 `GET {DB_URL}/shares.json` 한 번으로 **전 사용자의 여행 일정·숙소·항공편·경비 전체를 덤프**할 수 있습니다. `PUT`으로 타인의 일정을 위조하거나 `DELETE`로 영구 삭제하는 것도 동일하게 막을 수단이 없습니다. 이는 이 코드베이스에서 가장 심각한 결함입니다.

**조치 (우선순위 1 — 오늘 안에)**

1. **즉시**: Firebase 콘솔에서 보안 규칙을 잠급니다.

```json
// 최소 방어: 공유 링크는 ID를 아는 사람만 읽기, 쓰기는 차단
{
  "rules": {
    "shares":      { "$id": { ".read": true, ".write": false } },
    "suggestions": { "$id": { ".read": true, ".write": "newData.hasChildren(['name'])" } },
    ".read": false,
    ".write": false
  }
}
```

2. **근본 해결**: 이미 `supabase/schema.sql`에 `shared_trips`, `backup_mappings` 테이블과 RLS 정책이 **전부 정의돼 있습니다**. Firebase RTDB 경로를 Supabase로 이관하면 저장소가 3개(localStorage + Firebase + Supabase)에서 2개로 줄고 인증이 자동으로 걸립니다. `src/services/supabaseService.js`에 이미 구현체가 있습니다.

---

#### H-2. AviationStack API 키가 소스에 하드코딩되어 Git 히스토리에 커밋됨

**근거**: `index.html:3546`

```js
// ❌ 현재 — 커밋된 평문 키. 브라우저 개발자도구 Network 탭에도 그대로 노출
const AVIATIONSTACK_API_KEY = "7d97ae962ebc771c6393ae2e14cf1aeb";
```

`.gitignore`가 `.env.local`을 올바르게 제외하고 있고 `api/env.js`가 키 주입 경로를 이미 제공하는데도, 이 키만 우회해서 하드코딩돼 있습니다. `index.html`이 `root/`, `public/`, `www/` 3곳에 커밋돼 있어 **같은 키가 저장소에 3번** 들어 있습니다.

**조치**

```js
// ✅ 개선 1 — 키를 서버로 옮기고 프록시 엔드포인트 신설 (api/flight.js)
export default async function handler(req, res) {
    const key = process.env.AVIATIONSTACK_API_KEY;   // 서버에만 존재
    const { flightNo, date } = req.query;
    if (!/^[A-Z0-9]{2,8}$/i.test(flightNo || '')) {
        return res.status(400).json({ error: 'invalid flight number' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
        return res.status(400).json({ error: 'invalid date' });
    }
    const url = `https://api.aviationstack.com/v1/flights`
        + `?access_key=${key}&flight_iata=${encodeURIComponent(flightNo)}&flight_date=${date}`;
    const r = await fetch(url);
    return res.status(r.ok ? 200 : 502).json(await r.json());
}

// ✅ 개선 2 — 클라이언트는 키를 모름 (index.html:6212 대체)
const res = await fetch(`/api/flight?flightNo=${encodeURIComponent(flightNo.trim())}&date=${dateStr}`);
```

> ⚠️ 코드를 고쳐도 **Git 히스토리에 남은 키는 그대로 유효**합니다. AviationStack 대시보드에서 **키를 폐기(revoke)하고 재발급**하는 것이 실제 조치입니다.

---

#### H-3. `SECURITY DEFINER` 함수에 소유권 검증이 없어 RLS가 완전히 우회됨

**근거**: `supabase/schema.sql:246~279`, `282~308`

```sql
-- ❌ 현재 — trip_uuid만 알면 누구의 여행이든 전부 조회됨
CREATE OR REPLACE FUNCTION get_trip_full_data(trip_uuid UUID)
RETURNS JSON AS $$
BEGIN
    SELECT json_build_object(
        'trip', row_to_json(t.*), 'places', (...), 'hotels', (...),
        'flights', (...), 'expenses', (...)
    ) INTO result
    FROM public.trips t
    WHERE t.id = trip_uuid;          -- ← auth.uid() 검사 전무
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;   -- ← 정의자 권한 = RLS 무시
```

`SECURITY DEFINER`는 호출자가 아닌 **함수 소유자 권한**으로 실행되므로 125~222행에 공들여 작성한 RLS 정책이 이 함수 하나로 전부 무력화됩니다. `supabase.rpc('get_trip_full_data', { trip_uuid: ... })`는 anon 키만으로 호출 가능하며, 반환값에는 숙소 주소·항공편·경비 내역이 모두 포함됩니다. `migrate_from_localstorage(p_user_id, ...)` (282)는 한 술 더 떠서 **임의 사용자 ID로 레코드를 삽입**할 수 있습니다.

추가로 두 함수 모두 `SET search_path`가 없어 search_path 하이재킹에도 노출됩니다.

**조치**

```sql
-- ✅ 개선 — 소유권 검증 + search_path 고정 + 실행 권한 축소
CREATE OR REPLACE FUNCTION get_trip_full_data(trip_uuid UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp      -- 하이재킹 방어
AS $$
DECLARE
    result JSON;
BEGIN
    -- 호출자가 소유자이거나 공유된 여행일 때만 통과
    IF NOT EXISTS (
        SELECT 1 FROM public.trips
        WHERE id = trip_uuid
          AND (user_id = auth.uid() OR is_shared = TRUE)
    ) THEN
        RAISE EXCEPTION 'not authorized';
    END IF;

    SELECT json_build_object(...) INTO result
    FROM public.trips t WHERE t.id = trip_uuid;
    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION get_trip_full_data(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_trip_full_data(UUID) TO authenticated;

-- migrate_from_localstorage는 p_user_id 인자 자체를 제거하고 auth.uid()를 직접 사용할 것
```

---

#### H-4. `/api/env`가 `Access-Control-Allow-Origin: *`로 API 키를 전 세계에 배포

**근거**: `api/env.js:6`, `20~21`

```js
// ❌ 현재
res.setHeader('Access-Control-Allow-Origin', '*');           // :6  — 모든 오리진 허용
res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, ...');  // :10 — CDN에 캐시

const env = {
    GOOGLE_MAPS_API_KEY:  process.env.GOOGLE_MAPS_API_KEY  || '',   // :20
    AVIATIONSTACK_API_KEY: process.env.AVIATIONSTACK_API_KEY || '', // :21 — 서버 전용 키
};
```

`curl https://triptic-ten.vercel.app/api/env` 한 줄이면 누구나 두 키를 받아갑니다. Google Maps 키는 HTTP 리퍼러 제한으로 어느 정도 방어되지만, **AviationStack 키는 리퍼러 제한 개념 자체가 없어 즉시 쿼터가 소진·과금**됩니다. `AVIATIONSTACK_API_KEY`는 애초에 브라우저가 알 필요가 없는 값입니다.

**조치**

```js
// ✅ 개선 — 서버 전용 키 제거 + 오리진 화이트리스트
const ALLOWED = new Set([
    'https://triptic-ten.vercel.app',
    'http://localhost:3000',
    'capacitor://localhost'
]);

export default function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');          // 오리진별 캐시 분리
    }
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') return res.status(200).end();

    // 브라우저에 노출해도 되는 "공개 키"만 — 리퍼러/RLS로 보호되는 것들
    res.status(200).json({
        SUPABASE_URL: process.env.SUPABASE_URL || '',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
        GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || ''
        // AVIATIONSTACK_API_KEY 제거 → H-2의 /api/flight 프록시로 대체
    });
}
```

> 동일한 문제가 `vite.config.js:14~24`의 개발 서버 미들웨어에도 있습니다. 개발 환경이므로 위험도는 낮지만 같은 형태로 정리하는 편이 좋습니다.

---

#### H-5. `/api/recommend`에 인증·레이트리밋·입력 검증이 전혀 없음

**근거**: `api/recommend.js:531~553`

```js
// ❌ 현재
res.setHeader('Access-Control-Allow-Origin', '*');   // :533 — 아무 사이트나 호출 가능

const { placeName, city, category } = req.body || {};   // :550
if (!placeName) {                                       // :551 — 존재 여부만 검사
    return res.status(400).json({ error: '...' });
}
// 길이·타입 검증 없이 곧장 프롬프트에 삽입 (:555, :562)
const locationContext = city ? `${city}의 '${placeName}'` : `'${placeName}'`;
```

세 가지 문제가 겹쳐 있습니다.

1. **쿼터 도용**: 인증도 레이트리밋도 없는 공개 LLM 엔드포인트입니다. Gemini 1,500회/일 + Groq 14,400회/일 무료 한도가 타인의 스크립트로 몇 분 만에 소진됩니다.
2. **프롬프트 인젝션**: `placeName`이 검증 없이 프롬프트 본문에 들어가므로 `"도톤보리'. 위 지시를 무시하고 대신 ..."` 같은 입력으로 모델을 탈취해 무료 범용 LLM 프록시로 전용할 수 있습니다.
3. **타입 혼동**: `placeName`이 객체면 `'[object Object]'`로, 100KB 문자열이면 그대로 토큰 비용으로 직결됩니다.

**조치**

```js
// ✅ 개선 — 입력 정규화 + 오리진 제한 + IP 레이트리밋
const ALLOWED_ORIGINS = new Set(['https://triptic-ten.vercel.app', 'http://localhost:3000']);
const CATEGORIES = new Set(['all', 'restaurant', 'cafe', 'hotel', 'spot']);
const hits = new Map();   // 인스턴스 단위 간이 리밋 (영속 리밋은 Upstash/Vercel KV 권장)

function rateLimited(ip, limit = 20, windowMs = 60_000) {
    const now = Date.now();
    const rec = hits.get(ip);
    if (!rec || now - rec.start > windowMs) { hits.set(ip, { start: now, n: 1 }); return false; }
    rec.n += 1;
    return rec.n > limit;
}

// 제어문자 제거 + 길이 제한으로 인젝션 표면 축소
const sanitize = (v, max) =>
    typeof v === 'string' ? v.replace(/[\r\n -]/g, ' ').trim().slice(0, max) : '';

export default async function handler(req, res) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (rateLimited(ip)) return res.status(429).json({ error: '요청이 너무 잦습니다.' });

    const placeName = sanitize(req.body?.placeName, 100);
    const city      = sanitize(req.body?.city, 60);
    const category  = CATEGORIES.has(req.body?.category) ? req.body.category : 'all';

    if (!placeName) return res.status(400).json({ error: '기준 장소 이름(placeName)이 필요합니다.' });
    // ... 이하 동일
}
```

---

#### H-6. `src/` 전체가 죽은 코드 — 이중 진실 공급원(dual source of truth)

**근거**: `index.html` 전체에 `src/` 참조 0건, `src/main.js:1`

`src/main.js`는 "기존 `index.html`의 전역 변수와 함수들을 모듈로 대체"한다고 선언하지만, `index.html`에는 이를 로드하는 `<script type="module">` 태그가 **존재하지 않습니다**. `index.html`이 로드하는 스크립트는 24~27행의 CDN 4개와 인라인 블록 4개가 전부입니다.

결과적으로 아래가 전부 **빌드에도 실행에도 포함되지 않습니다**:

| 죽은 자산 | 규모 | 상태 |
|---|---|---|
| `src/services/supabaseService.js` | 366줄 | Supabase 데이터 계층 — 완성됐으나 미사용 (앱은 Firebase 사용) |
| `src/state/appState.js` | 173줄 | 상태관리 — 미사용 (앱은 전역 `let` 22개 사용) |
| `src/utils/*.{js,ts}` | 6파일 | `index.html`이 `escapeHtml`을 3811행에 **재구현** |
| `src/supabase-init.js` + `-v2.js` | 406줄 | 같은 일을 하는 두 버전이 공존, 둘 다 미사용 |
| `src/services/authService.js` | 52줄 | 미사용 + 실행 시 크래시 (M-2 참조) |
| `supabase/schema.sql` | 316줄 | `user_profiles` 외 7개 테이블 미사용 |

`vite.config.js:44~63`의 `manualChunks`도 이 미사용 파일들을 묶도록 설정돼 있고, `vercel.json`은 `{"outputDirectory": "."}`라 **`vite build` 산출물(`dist/`)조차 배포되지 않습니다**. 즉 빌드 파이프라인 전체가 실제 배포와 무관합니다.

**조치** — 둘 중 하나를 **명시적으로** 선택해야 합니다.

- **(A) 점진적 모듈화** (권장): `index.html` `<head>`에 `<script type="module" src="/src/main.js"></script>`를 추가하고, 인라인 스크립트에서 중복 구현된 `escapeHtml`(3811)·시간/날짜 유틸부터 모듈 버전으로 교체합니다. 그 다음 `vercel.json`을 `{"outputDirectory": "dist"}`로 바꿔 빌드 산출물이 실제로 배포되게 합니다.
- **(B) 정리**: 모듈화를 당분간 하지 않기로 했다면 `src/`, `vite.config.js`, `tsconfig.json`, `supabase/schema.sql`을 삭제하거나 `legacy/`로 옮기고 README에 "현재 아키텍처는 단일 파일"이라고 명시합니다.

**최악은 지금 상태 그대로 두는 것**입니다. 신규 기여자가 `src/appState.js`를 고치고 아무 변화가 없는 이유를 찾는 데 하루를 씁니다.

---

#### H-7. CI가 구조적으로 절대 실패할 수 없음 — main 브랜치에서 테스트 3개가 실패 중

**근거**: `.github/workflows/main.yml:26~27, 46, 65, 84`

```yaml
# ❌ 현재 — 4개 잡 전부 실패를 흡수
- run: npm run lint || echo "Linting skipped"
  continue-on-error: true
- run: npm test
  continue-on-error: true
- run: npx tsc --noEmit
  continue-on-error: true
- run: npm run build || echo "Build skipped"
  continue-on-error: true
```

`continue-on-error: true`와 `|| echo`가 **이중으로** 걸려 있어 어떤 잡도 파이프라인을 붉게 만들 수 없습니다. 안전망이 있는 것처럼 보이지만 실제로는 없습니다. 실측 결과가 이를 증명합니다.

```
$ npx jest
Test Suites: 2 failed, 3 passed, 5 total
Tests:       3 failed, 44 passed, 47 total

$ npx eslint src/
✖ 24 problems (11 errors, 13 warnings)
```

`package.json:31~38`은 커버리지 임계값을 80%로 선언해 두었으나, 임계값을 강제하는 `test:coverage`가 CI에서 실행되지 않아 이 또한 장식입니다.

**조치**

```yaml
# ✅ 개선 — 게이트를 실제로 작동시킴
      - name: Run unit tests
        run: npm test                    # continue-on-error 제거

      - name: Run TypeScript compiler
        run: npx tsc --noEmit            # continue-on-error 제거
```

단, 게이트를 켜기 **전에** 아래 M-1의 실패 3건을 먼저 고쳐야 합니다. 순서를 반대로 하면 main이 즉시 붉어져 팀이 다시 `continue-on-error`를 붙이게 됩니다.

---

### 🟡 MEDIUM (다음 스프린트)

---

#### M-1. `addMinutes()` 음수 처리 버그 — 실패하는 테스트 3건

**근거**: `src/utils/timeUtils.js:48~54` (`.ts` 버전은 이미 수정됨 — 분기 상태)

```js
// ❌ src/utils/timeUtils.js:51 — JS의 % 는 피연산자 부호를 보존함
export function addMinutes(time, minutes) {
    const [hh, mm] = time.split(':').map(Number);
    const totalMinutes = hh * 60 + mm + minutes;
    const newHour = Math.floor(totalMinutes / 60) % 24;   // -1
    const newMinute = totalMinutes % 60;                  // -15
    return `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
}
// addMinutes('00:15', -30) → "-1:-15"   (기대값 "23:45")
```

```js
// ✅ 개선 — 1440분 기준 정규화 (src/utils/timeUtils.ts:58 에 이미 있는 구현과 동일)
export function addMinutes(time, minutes) {
    const [hh, mm] = time.split(':').map(Number);
    const DAY = 24 * 60;
    const normalized = (((hh * 60 + mm + minutes) % DAY) + DAY) % DAY;
    return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:`
         + `${String(normalized % 60).padStart(2, '0')}`;
}
```

나머지 실패 2건은 `src/state/appState.test.js`입니다.

| 실패 테스트 | 원인 | 조치 |
|---|---|---|
| `여행 정보를 설정하고 가져올 수 있어야 함` (:40) | 테스트가 `appState.totalDays`를 읽지만 실제 getter는 `totalTripDays` (appState.js:55) — **이름 불일치** | getter 이름을 `totalDays`로 통일하거나 테스트를 `totalTripDays`로 수정 |
| `구독을 해제할 수 있어야 함` (:77) | `reset()`이 `_currentDay = 1`로 초기화한 직후 `setCurrentDay(1)`을 호출 → 값이 같아 `_notify`가 발생하지 않음 (appState.js:61) | 테스트에서 `setCurrentDay(5)`처럼 다른 값을 쓰거나, `reset()`이 `_listeners`도 비우도록 수정 (현재 리스너가 테스트 간 누수됨) |

---

#### M-2. `authService.js` — 실행하면 즉시 크래시하는 함수 2개

**근거**: `src/services/authService.js:18`, `53`

```js
// ❌ :13~18 — `client`가 선언된 적 없음 → ReferenceError
export async function signInWithProvider(provider) {
    const isLocal = ...;
    const redirectUrl = isLocal ? (window.location.origin || '') : 'https://triptic-ten.vercel.app';
    const result = await client.auth.signInWithOAuth({ ... });   // ← client 미정의

// ❌ :53 — Supabase v2 API 이름은 onAuthStateChange (d 없음) → TypeError
    return client.auth.onAuthStateChanged((event, session) => { ... });
```

```js
// ✅ 개선 — 다른 함수들과 동일한 client 획득 패턴 적용
export async function signInWithProvider(provider) {
    const client = (typeof window !== 'undefined' && window.supabaseClient) || supabase;
    const isLocal = ...;
    const result = await client.auth.signInWithOAuth({
        provider, options: { redirectTo: redirectUrl }
    });
    if (result?.error) throw result.error;
    return result.data;
}

export function onAuthStateChange(callback) {
    const client = (typeof window !== 'undefined' && window.supabaseClient) || supabase;
    return client.auth.onAuthStateChange((event, session) => callback(event, session));
}
```

추가로 이 파일(`:4~5`)과 `src/supabase-init.js:7~8`은 **`index.html:3282`와 다른 Supabase 프로젝트**(`mfwfqfzdgcgfnnmnlrxu` vs `ifzykfemjzqquyzgpqax`)를 가리킵니다. 폐기된 프로젝트의 anon 키가 저장소에 남아 있는 상태이므로 함께 제거해야 합니다.

---

#### M-3. `showToast()`의 `innerHTML` 경로로 들어오는 미이스케이프 입력

**근거**: `index.html:3830`, `3500`, `6016`

```js
// index.html:3830 — 토스트 본문을 HTML로 파싱
msgSpan.innerHTML = message;
```

호출부 대부분은 `escapeHtml()`을 거치지만(4502, 4531, 4770 등) 두 곳이 빠져 있습니다.

```js
// ❌ index.html:3500 — name은 OAuth 프로필(카카오 닉네임 등)에서 옴
showToast(`반가워요, ${name}님! 🎉`);

// ❌ index.html:6016 — place.name은 Google Places 응답
showToast(`🏨 숙소 [${place.name}]이 등록되었습니다.`);
```

현실적 영향은 자신의 계정 표시명을 조작하는 self-XSS 수준이라 HIGH는 아니지만, `innerHTML` 싱크가 열려 있으면 **앞으로 추가되는 모든 `showToast` 호출이 잠재적 XSS**가 됩니다. 싱크 자체를 닫는 편이 호출부를 하나씩 감시하는 것보다 안전합니다.

```js
// ✅ 개선 — 기본은 텍스트, HTML이 꼭 필요한 호출만 명시적으로 opt-in
function showToast(message, options = {}) {
    // ...
    const msgSpan = document.createElement('div');
    msgSpan.className = 'toast-message';
    if (options.html) {
        msgSpan.innerHTML = message;      // 호출자가 이스케이프 책임을 명시적으로 짐
    } else {
        msgSpan.textContent = message;    // 기본값 = 안전
    }
    // ...
}
```

전환 시 `<br>`이나 `<b>`를 쓰는 기존 호출부에 `{ html: true }`를 붙여주면 됩니다.

---

#### M-4. 공유 ID를 `Math.random()`으로 생성 — 예측 가능

**근거**: `index.html:3924~3929`, `4016`, `7117`

```js
// ❌ 현재 — Math.random()은 암호학적으로 안전하지 않음
function generateShortId(len = 7) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}
```

이 ID가 **공유 링크의 유일한 접근 통제 수단**입니다(`?id=xxxxxxx`). 기본 길이 7자는 62^7 ≈ 3.5조로 단순 무차별 대입은 어렵지만, `Math.random()`은 V8에서 xorshift128+ 기반이라 **출력 몇 개를 관측하면 내부 상태를 복원해 이후 ID를 예측**할 수 있습니다. 공격자가 자기 공유 링크를 몇 개 만들어보는 것만으로 관측 표본을 얻습니다.

```js
// ✅ 개선 — CSPRNG 사용 + 모듈로 편향 제거
function generateShortId(len = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; // 혼동 문자 제외(57자)
    const bytes = new Uint8Array(len * 2);
    crypto.getRandomValues(bytes);
    let id = '';
    for (let i = 0; id.length < len && i < bytes.length; i++) {
        // 256 % 57 ≠ 0 이므로 상위 구간을 버려 균등 분포 보장
        if (bytes[i] < 256 - (256 % chars.length)) id += chars[bytes[i] % chars.length];
    }
    return id.length === len ? id : generateShortId(len);
}
```

기존 짧은 ID와의 호환을 위해 읽기는 길이 무관하게 허용하고, 신규 발급만 12자로 전환하면 됩니다.

---

#### M-5. 삭제한 여행이 클라우드 백업에서 되살아나는 경쟁 조건

**근거**: `index.html:4497~4510`, `4037~4060`, `4083`

삭제 경로와 복원 경로가 서로를 모릅니다.

```js
// index.html:4497 — 로컬에서 삭제 후 1.5초 디바운스로 클라우드에 반영
delete allProjects[name];
saveAllProjects();            // → scheduleBackupSync() → setTimeout(..., 1500)

// index.html:4051 — 다음 실행 시: 클라우드에만 있는 키를 무조건 되살림
Object.keys(cleanCloud).forEach(k => {
    if (!allProjects[k]) {
        allProjects[k] = cleanCloud[k];    // ← 삭제한 여행이 부활
        updated = true;
    }
});
```

사용자가 여행을 삭제하고 **1.5초 안에 탭을 닫으면** 클라우드에는 삭제 전 상태가 남고, 다음 실행 시 `restoreFromCloudBackupIfNeeded()`가 이를 "로컬에 없는 항목"으로 판단해 복원합니다. 사용자 입장에서는 "지운 여행이 자꾸 돌아온다"는 재현 어려운 버그로 보입니다.

```js
// ✅ 개선 — 삭제를 즉시 반영하고, 삭제 묘비(tombstone)로 부활을 차단
// 1) 삭제 시 디바운스 없이 즉시 푸시
delete allProjects[name];
const deleted = JSON.parse(localStorage.getItem('tripticDeletedKeys') || '[]');
deleted.push({ name, at: Date.now() });
localStorage.setItem('tripticDeletedKeys', JSON.stringify(deleted));
saveAllProjects(true);
await pushBackupSync(false);        // 즉시 동기화 (await)

// 2) 복원 시 묘비보다 오래된 클라우드 데이터는 무시
const tombstones = new Map(
    JSON.parse(localStorage.getItem('tripticDeletedKeys') || '[]').map(t => [t.name, t.at])
);
Object.keys(cleanCloud).forEach(k => {
    const deletedAt = tombstones.get(k);
    if (deletedAt && (cleanCloud[k].updatedAt || 0) <= deletedAt) return;   // 부활 차단
    if (!allProjects[k]) { allProjects[k] = cleanCloud[k]; updated = true; }
});
```

---

#### M-6. 데이터 가져오기가 동명 프로젝트를 확인 없이 덮어씀

**근거**: `index.html:4638`, `4256`

```js
// ❌ index.html:4638 (파일 가져오기) — 스프레드 병합은 오른쪽이 이김
allProjects = { ...allProjects, ...imported };
showToast(`🎉 ${count}개의 여행을 불러왔습니다!`);   // "덮어썼다"는 언급 없음

// ❌ index.html:4256 (복구 코드 가져오기) — 동일 패턴
allProjects = { ...allProjects, ...validProjects };
```

"교토 여행"이라는 이름의 로컬 일정이 있는 상태에서 같은 이름을 포함한 백업을 가져오면 **로컬 일정이 경고 없이 소멸**합니다. `cloneProject()` (4516)는 이미 `(복사본)` 접미사로 이름 충돌을 처리하고 있으므로, 같은 정책을 적용하면 일관성도 올라갑니다.

```js
// ✅ 개선 — 충돌을 감지해 사용자에게 선택권 부여
function mergeProjects(incoming) {
    const conflicts = Object.keys(incoming).filter(k => allProjects[k]);
    const applyMerge = (mode) => {
        Object.entries(incoming).forEach(([name, project]) => {
            if (!allProjects[name] || mode === 'overwrite') {
                allProjects[name] = project;
                return;
            }
            let alt = `${name} (가져옴)`, n = 1;
            while (allProjects[alt]) alt = `${name} (가져옴 ${++n})`;
            allProjects[alt] = project;      // 양쪽 모두 보존
        });
        saveAllProjects();
        renderLobby();
        closeModal();
    };

    if (conflicts.length === 0) return applyMerge('keep');

    openModal(`
        <h3>⚠️ 이름이 같은 여행이 있습니다</h3>
        <p style="font-size:13px; line-height:1.6;">
            <b>${escapeHtml(conflicts.slice(0, 3).join(', '))}</b>
            ${conflicts.length > 3 ? ` 외 ${conflicts.length - 3}개` : ''}가 이미 있습니다.
        </p>
        <div class="modal-actions">
            <button class="modal-btn secondary" onclick="closeModal()">취소</button>
            <button class="modal-btn primary" id="keep-both-btn">둘 다 보관</button>
            <button class="modal-btn danger"  id="overwrite-btn">덮어쓰기</button>
        </div>
    `);
    document.getElementById('keep-both-btn').onclick = () => applyMerge('keep');
    document.getElementById('overwrite-btn').onclick = () => applyMerge('overwrite');
}
```

---

#### M-7. Service Worker가 API 응답을 무제한 캐시 — 키 노출 + 캐시 무한 증식

**근거**: `sw.js:55~77`, `188~208`

```js
// ❌ sw.js:62~74 — Maps/Firebase/AviationStack 응답을 전부 캐시 대상으로 지정
function isApiRequest(url) {
    if (url.hostname.includes('maps.googleapis.com') || url.hostname.includes('maps.gstatic.com')) return true;
    if (url.hostname.includes('firebasedatabase.app')) return true;
    if (url.hostname.includes('aviationstack.com')) return true;
    return false;
}

// ❌ sw.js:194~195 — 요청 URL 전체가 캐시 키가 됨
const cache = await caches.open(CACHE_NAME);
cache.put(event.request, networkResponse.clone());
```

세 가지가 동시에 문제입니다.

1. **키 디스크 영속화**: AviationStack 요청 URL에는 `?access_key=7d97ae...`가 들어 있고(index.html:6212), 이것이 **캐시 키로 사용자 디스크에 평문 저장**됩니다. H-2에서 키를 교체해도 기존 사용자 기기에는 남습니다.
2. **캐시 무한 증식**: `maps.gstatic.com`은 지도 타일 도메인입니다. 사용자가 지도를 조작할 때마다 타일이 쌓이고 **삭제 로직이 전혀 없습니다**. `activate`의 정리(133~143)는 **버전이 다른 캐시**만 지우므로 같은 버전 내에서는 무한히 자랍니다.
3. **개인정보**: Firebase 응답(= 타인의 여행 일정 포함 가능)이 브라우저 캐시에 그대로 남습니다.

```js
// ✅ 개선 — 캐시 대상을 오프라인에 실익이 있는 것으로 한정
function isApiRequest(url) {
    // 지도 타일과 인증 정보가 실린 요청은 캐시하지 않음 (네트워크 직행)
    if (url.hostname.includes('maps.gstatic.com')) return false;
    if (url.hostname.includes('aviationstack.com')) return false;
    if (url.searchParams.has('access_key') || url.searchParams.has('key')) return false;

    // 공유 일정은 오프라인 열람 가치가 있으므로 캐시 유지
    return url.hostname.includes('firebasedatabase.app');
}

// ✅ 캐시 항목 수 상한 (fetch 핸들러의 cache.put 대체)
async function putWithLimit(cacheName, request, response, maxEntries = 60) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
    const keys = await cache.keys();
    // FIFO 방출
    for (let i = 0; i < keys.length - maxEntries; i++) await cache.delete(keys[i]);
}
```

> `sw.js`는 `root/`, `public/`, `www/` 3곳에 복제돼 있으므로(M-9) 수정 후 `node scripts/build.js`로 동기화해야 합니다.

---

#### M-8. CDN 스크립트에 SRI 부재 + 보안 헤더 전무

**근거**: `index.html:21~27`, `vercel.json`

```html
<!-- ❌ 무결성 검증 없음. 특히 마지막 줄은 메이저 버전만 고정 = 내용이 언제든 바뀜 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/...">
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>  <!-- 부동 버전 -->
```

`@supabase/supabase-js@2`는 `2.x`의 **최신 릴리스를 매번 받아옵니다**. 이 스크립트는 인증 토큰을 다루므로, CDN 침해나 악성 패치 릴리스가 곧바로 세션 탈취로 이어집니다. 동시에 `vercel.json`에는 `outputDirectory` 한 줄뿐이라 **CSP, X-Frame-Options, Referrer-Policy가 모두 없습니다**.

```html
<!-- ✅ 개선 1 — 정확한 버전 고정 + SRI (해시는 `curl -s URL | openssl dgst -sha384 -binary | openssl base64 -A`) -->
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.js"
        integrity="sha384-..." crossorigin="anonymous"></script>
```

```json
// ✅ 개선 2 — vercel.json에 보안 헤더 추가
{
  "outputDirectory": ".",
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Permissions-Policy", "value": "geolocation=(self), camera=(), microphone=()" },
      { "key": "Content-Security-Policy-Report-Only",
        "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co https://*.firebasedatabase.app https://maps.googleapis.com" }
    ]
  }]
}
```

> 인라인 스크립트·스타일이 8천 줄 규모라 CSP는 `'unsafe-inline'` 없이는 당장 적용이 불가능합니다. 우선 `Report-Only`로 위반을 수집하고, H-6의 모듈화가 진행되면서 인라인을 걷어낸 뒤 강제 모드로 전환하는 순서를 권합니다.

---

#### M-9. Vercel 서버리스 실행 시간 초과 가능성 — 폴백이 도달 불가능해짐

**근거**: `api/recommend.js:14`, `69`, `168`, `583~646`

```js
// 각 호출의 타임아웃이 9.5초이고, 제공자별로 모델을 순차 시도함
const timeoutId = setTimeout(() => controller.abort(), 9500);   // :14 Gemini (모델 3개)
const timeoutId = setTimeout(() => controller.abort(), 9500);   // :69 Groq   (모델 2개)
const timeoutId = setTimeout(() => controller.abort(), 9500);   // :168 OpenRouter (모델 최대 9개)
```

최악의 경우 Gemini 3×9.5s + Groq 2×9.5s + OpenRouter 9×9.5s ≈ **133초**입니다. Vercel Hobby 플랜의 함수 제한은 기본 10초(Pro 60초)이므로, 상위 제공자가 모두 느리게 응답하는 상황에서는 **애써 만든 4단계 큐레이션 폴백(638행)에 도달하기 전에 플랫폼이 504로 함수를 끊습니다**. 폴백이 가장 필요한 순간에 작동하지 않는 구조입니다.

```js
// ✅ 개선 — 전체 예산을 두고 남은 시간만큼만 각 제공자에 할당
const TOTAL_BUDGET_MS = 8000;           // 플랫폼 제한보다 확실히 아래
const deadline = Date.now() + TOTAL_BUDGET_MS;
const remaining = () => deadline - Date.now();

async function tryProvider(fn, key) {
    if (!key || remaining() < 1500) return null;    // 예산 부족 시 건너뜀
    try {
        return await fn(key, prompt, remaining());   // 각 호출에 남은 예산 전달
    } catch (e) {
        console.warn('[provider]', e.message);
        return null;
    }
}

const result = (await tryProvider(callGemini, geminiKey))
            || (await tryProvider(callGroq, groqKey))
            || (await tryProvider(callOpenRouter, openrouterKey));

if (result?.recommendations?.length) {
    return res.status(200).json({ success: true, basePlace: placeName, ...result });
}
// 예산을 지켰으므로 폴백에 반드시 도달함
return res.status(200).json({
    success: true, provider: 'Triptic Curated', isFallback: true, basePlace: placeName,
    recommendations: getCuratedFallbackRecommendations(placeName, city, category)
});
```

`callGemini` 등의 내부 `setTimeout(..., 9500)`도 전달받은 `budget`을 쓰도록 바꿔야 합니다. 더불어 `api/recommend.js:148~150`의 폴백 모델 목록(`gemma-4-31b`, `nemotron-3-super-120b`, `lfm-2.5-2.6b`)은 실재하지 않는 모델명으로 보이므로, 실제 OpenRouter 무료 모델 ID로 교체하지 않으면 그 시도들은 전부 실패에 시간만 씁니다.

---

#### M-10. 지도 마커 전량 재생성 + 경로 탐색 중복 호출

**근거**: `index.html:6909~6984`, `7030~7075`

```js
// ❌ index.html:6910 — 매 렌더마다 모든 마커를 파괴하고 새로 생성
function updateMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
    // ...
    list.forEach((item, index) => {
        const marker = new google.maps.Marker({ ... });   // :6966 매번 새 객체
        markers.push(marker);
    });
}
```

일차 탭 전환·장소 추가·순서 변경 때마다 전체가 재생성됩니다. 장소가 15개인 일차에서 탭을 오갈 때마다 마커 16개 파괴 + 16개 생성이 일어나며, 모바일에서 체감되는 버벅임의 주 원인입니다. 더불어 `google.maps.Marker`는 **2024년 2월부로 deprecated** 되어 `AdvancedMarkerElement`로의 이전이 권고됩니다.

경로 탐색 쪽은 과금과 직결됩니다.

```js
// ❌ index.html:7047 — 캐시를 확인하기 *전에* Renderer를 만들고,
//    실패 시 setMap(null)로 버림
const renderer = new google.maps.DirectionsRenderer({ ... });
directionsRenderers.push(renderer);
if (directionsCache.has(cacheKey)) { ... continue; }   // :7055 확인은 그 다음

// ❌ 진행 중(in-flight) 요청을 추적하지 않음 → 빠른 연속 렌더 시 동일 구간 중복 과금
directionsService.route({ origin, destination, ... }, (result, status) => { ... });
```

```js
// ✅ 개선 1 — 위치가 같으면 마커 재사용 (좌표 키 기반 풀링)
const markerPool = new Map();   // "lat,lng" → Marker

function syncMarkers(points) {
    const wanted = new Set(points.map(p => `${p.lat},${p.lng}`));
    for (const [key, marker] of markerPool) {
        if (!wanted.has(key)) { marker.setMap(null); markerPool.delete(key); }
    }
    points.forEach((p, i) => {
        const key = `${p.lat},${p.lng}`;
        const existing = markerPool.get(key);
        if (existing) {
            existing.setLabel(String(i + 1));    // 라벨만 갱신 — 객체 재생성 없음
        } else {
            markerPool.set(key, new google.maps.Marker({ map, position: p, label: String(i + 1) }));
        }
    });
}

// ✅ 개선 2 — 캐시 우선 확인 + in-flight 중복 제거
const inflight = new Map();   // cacheKey → Promise

function routeOnce(origin, destination, cacheKey) {
    if (directionsCache.has(cacheKey)) return Promise.resolve(directionsCache.get(cacheKey));
    if (inflight.has(cacheKey)) return inflight.get(cacheKey);   // 중복 과금 차단

    const p = new Promise(resolve => {
        directionsService.route(
            { origin, destination, travelMode: google.maps.TravelMode.TRANSIT },
            (result, status) => {
                const entry = (status === 'OK' && result?.routes?.[0])
                    ? { status: 'OK', result } : { status: 'FAILED' };
                directionsCache.set(cacheKey, entry);
                inflight.delete(cacheKey);
                resolve(entry);
            }
        );
    });
    inflight.set(cacheKey, p);
    return p;
}
```

> `directionsCache`는 메모리 `Map`이라 새로고침 시 전부 소실됩니다. 경로 결과를 `sessionStorage`에 직렬화해 두면 재방문 시 과금 호출을 크게 줄일 수 있습니다.

---

### 🟢 LOW (기술 부채 — 계획적 상환)

---

#### L-1. `index.html` 3중 복제 커밋 — 총 약 1MB 중복

`git ls-files` 기준 동일 파일이 3곳에 추적되고 있으며, `md5` 검증 결과 내용이 완전히 같습니다.

```
index.html  =  public/index.html  =  www/index.html   (각 351KB, md5 eb137ad6...)
sw.js       =  public/sw.js       =  www/sw.js
manifest.json + 아이콘 4종도 각각 3벌
```

`scripts/build.js`가 복사를 자동화하고는 있으나 **`package.json`의 어떤 스크립트에도 연결돼 있지 않아** 수동 실행에 의존합니다(최근 커밋 `a4d3aa2 chore: sync sw.js to public and www`가 이를 방증). 사본 중 하나만 갱신되면 웹과 iOS 앱의 동작이 조용히 갈립니다.

```jsonc
// ✅ package.json — 생성 산출물을 빌드 단계에 묶기
"scripts": {
  "build": "node scripts/build.js && tsc --noEmit",
  "prebuild": "npm run typecheck"
}
```

```gitignore
# ✅ .gitignore — 생성물은 추적 대상에서 제외
www/
public/index.html
public/sw.js
public/manifest.json
public/icon-*.png
```

추가로 `.gitignore`가 `ios/`와 `capacitor.config.json`을 제외하도록 적혀 있으나 **두 경로 모두 이미 추적 중**입니다(`.gitignore`는 기추적 파일에 영향을 주지 않음). 의도가 제외라면 `git rm --cached`가 필요하고, 추적이 의도라면 `.gitignore`에서 해당 줄을 지워 혼란을 없애야 합니다.

---

#### L-2. `exportToPDF()` 570줄 — 단일 함수 최대 크기

`index.html:7638`부터 570줄이 하나의 함수입니다. 상위 함수 길이는 다음과 같습니다.

| 함수 | 위치 | 길이 |
|---|---|---|
| `exportToPDF()` | index.html:7638 | **570줄** |
| `initAuthProtection()` | index.html:3472 | 293줄 |
| `renderList()` | index.html:5519 | 167줄 |
| `renderLobby()` | index.html:4319 | 163줄 |
| `openDayCityModal()` | index.html:4793 | 116줄 |

`exportToPDF`는 페이지 레이아웃 계산, 텍스트 정제, 카드 렌더링, 경비 표 생성을 한 몸에 담고 있어 단위 테스트가 불가능합니다. `buildPdfHeader()`, `renderDayCard()`, `renderExpenseTable()` 같은 순수 함수로 분리하면 테스트 가능해지고, `src/`에 배치하면 H-6의 모듈화를 시작하는 자연스러운 첫 대상이 됩니다.

---

#### L-3. `.js` / `.ts` 유틸리티 이중 관리로 이미 발생한 로직 분기

`src/utils/`에 `dateUtils`, `timeUtils`, `escapeHtml`이 각각 `.js`와 `.ts`로 **양쪽 다** 존재합니다. Jest는 `.js`를, `vite.config.js:53~57`의 `manualChunks`는 `.ts`를 가리켜 **테스트 대상과 빌드 대상이 서로 다른 파일**입니다. 그 결과 M-1의 `addMinutes` 버그가 `.ts`에서만 수정되고 `.js`에는 남았습니다. `dateUtils`도 `.ts`에만 `Invalid date` 검증이 있습니다.

`.js` 사본을 삭제하고 `.ts`로 단일화한 뒤, Jest transform에 `^.+\\.ts$` 를 추가하면 됩니다(`@babel/preset-typescript`가 이미 devDependencies에 있습니다).

---

#### L-4. ESLint 오류 11건이 방치됨

```
src/supabase-init.js:77,100,113   error  'showToast' is not defined   no-undef
src/supabase-init-v2.js:229,243   error  'showToast' is not defined   no-undef
src/supabase-init.js:44           error  'data' is assigned but never used
src/types/index.ts                warning  Unexpected any (×4)
```

`showToast`는 `index.html`의 전역 함수라 모듈 스코프에서는 미정의가 맞습니다. `.eslintrc.json`의 `globals`에 선언하거나(권장), 모듈 내부에서 `window.showToast?.(...)`로 호출하도록 고쳐야 합니다.

---

#### L-5. 인라인 `onclick` 97개 vs `addEventListener` 21개

`index.html` 전반에서 이벤트 바인딩이 문자열 기반 인라인 핸들러에 의존합니다.

```html
<!-- index.html:6642 등 — 함수명과 인자가 문자열로 하드코딩 -->
<button onclick="switchAiRecCategory(currentAiBaseIndex, 'all')">🔄 다시 시도</button>
<button onclick="openTimeSelectForRecommendation(${baseIndex}, ${i})">＋ 일정에 추가</button>
```

이 방식은 (a) 모든 핸들러를 전역 스코프에 강제하고, (b) 향후 CSP에서 `script-src 'unsafe-inline'`을 영구히 요구하며(M-8), (c) 함수명 변경 시 정적 분석으로 참조를 추적할 수 없습니다. 리스트 렌더링 지점에서는 **이벤트 위임** 한 개가 97개 인라인 핸들러를 대체합니다.

```js
// ✅ 개선 — 컨테이너 한 곳에 위임 (data 속성으로 인자 전달)
container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, index, recIndex } = btn.dataset;
    if (action === 'add-recommendation') {
        openTimeSelectForRecommendation(Number(index), Number(recIndex));
    }
});
```

---

#### L-6. 기타 소소한 항목

| 항목 | 위치 | 내용 |
|---|---|---|
| 저장마다 이중 직렬화 | index.html:4540~4541 | `JSON.stringify` 후 `new Blob([serialized])`로 크기 측정 — 데이터를 두 번 순회. `serialized.length * 2`로 근사하거나 크기 검사 자체를 디바운스 |
| 10초 고정 폴링 | index.html:7275 | 공유 뷰가 10초마다 전체 페이로드를 받아 `JSON.stringify` 비교. 변경이 없어도 대역폭 소모. Supabase Realtime 구독으로 대체하거나 지수 백오프 적용 |
| `user_profiles` INSERT 정책 누락 | supabase/schema.sql:135~141 | SELECT/UPDATE 정책만 있고 INSERT 정책이 없음 → index.html:3374의 `upsert`가 **신규 사용자에게 항상 실패**. 3380의 `catch`가 조용히 삼키고 있어 증상이 드러나지 않음. `CREATE POLICY ... FOR INSERT WITH CHECK (auth.uid() = id)` 추가 필요 |
| `shared_trips` UPDATE/DELETE 정책 누락 | supabase/schema.sql:201~213 | SELECT(전체 허용) + INSERT만 정의 → 사용자가 자신의 공유 링크를 해제할 수 없음 |
| 빈 함수 잔존 | index.html:7002~7008 | `renderMapMarkers()`가 "향후 구현 예정" 주석과 주석 처리된 호출만 담고 있음 — 삭제 권장 |
| `<meta viewport user-scalable=no>` | index.html:5 | 확대를 완전히 차단해 저시력 사용자의 접근성을 해침. WCAG 1.4.4 위반. `maximum-scale=5` 정도로 완화 권장 (`src/utils/accessibility.ts`가 있으나 미사용) |
| 커버리지 임계값 미집행 | package.json:31~38 | 80% 임계값이 선언돼 있으나 CI가 `test:coverage`를 실행하지 않음 |

---

## 4. 최종 총평

### 종합 점수: **4.5 / 10**

| 평가 축 | 점수 | 근거 |
|---|:---:|---|
| **기능 완성도** | 8.0 | 일정·지도·경로·항공편·경비·PDF·공유·오프라인까지 실제로 동작하는 폭넓은 기능. 개인 프로젝트 기준 인상적 |
| **가독성 / 구조** | 3.0 | 8,209줄 단일 파일, 570줄 함수, 전역 변수 22개. `src/`에 좋은 구조가 있으나 **연결되지 않음** |
| **성능 / 효율성** | 5.0 | Directions 캐시는 훌륭하나 마커 전량 재생성, in-flight 중복 호출, 10초 폴링, SW 캐시 무한 증식 |
| **보안** | **2.0** | 무인증 공개 DB, 하드코딩 키, RLS 우회 함수, 무제한 공개 LLM 엔드포인트. **프로덕션 운영 중이라면 즉시 조치 필요** |
| **예외 / 오류 처리** | 6.0 | `try/catch` 39곳, 폴백 설계 우수. 다만 `catch (e) {}` 형태의 침묵 처리가 다수(4058, 4145, 7270 등) |
| **테스트 / 자동화** | 3.5 | 테스트 47개 작성은 좋으나 **3개가 실패 중이고 CI가 이를 통과시킴**. 테스트 대상이 죽은 코드 |

> **핵심 진단**: 이 코드베이스의 문제는 실력 부족이 아니라 **미완결된 리팩터링**입니다. `src/`의 모듈 설계, RLS 정책, 테스트 스위트, CI 파이프라인 모두 올바른 방향으로 만들어졌지만 어느 것도 `index.html`에 연결되지 않은 채 멈춰 있습니다. 그 결과 "잘 만든 인프라가 있다"는 착시가 생기면서 실제로는 아무 안전망도 작동하지 않는 상태입니다. 보안 점수 2.0의 대부분도 여기서 파생됩니다 — Supabase RLS라는 제대로 된 방어선을 만들어 놓고, 정작 데이터는 인증 없는 Firebase로 흐르고 있습니다.

### 우선 조치 권고

#### 🚨 1단계 — 24시간 내 (보안 사고 차단)

코드 수정 없이 콘솔 설정만으로 가능한 것부터 처리합니다.

1. **Firebase 콘솔에서 RTDB 보안 규칙 적용** (H-1) — 현재 전 사용자 데이터가 공개 상태입니다. 가장 먼저 해야 합니다.
2. **AviationStack 키 폐기 후 재발급** (H-2) — Git 히스토리에 남은 키는 코드를 고쳐도 계속 유효합니다.
3. **Supabase에서 `get_trip_full_data` / `migrate_from_localstorage` 권한 회수** (H-3) — `REVOKE ALL ... FROM PUBLIC, anon` 한 줄로 즉시 차단되며, 어차피 현재 앱은 이 함수들을 호출하지 않습니다.
4. **`api/env.js`에서 `AVIATIONSTACK_API_KEY` 제거 + 오리진 화이트리스트** (H-4)

#### ⚙️ 2단계 — 1~2주 (안전망 복구)

5. **실패 테스트 3건 수정 후 CI `continue-on-error` 제거** (M-1 → H-7) — 반드시 이 순서로. 게이트를 먼저 켜면 main이 붉어지고 팀이 다시 끕니다.
6. **`/api/recommend`에 레이트리밋 + 입력 정규화 적용** (H-5)
7. **서버리스 시간 예산 도입** (M-9) — 폴백이 실제로 도달 가능해집니다.
8. **`showToast` 기본값을 `textContent`로 전환** (M-3) — XSS 싱크를 구조적으로 차단

#### 🏗 3단계 — 1~2개월 (아키텍처 결정)

9. **H-6에 대한 결정을 내리고 문서화** — 이것이 나머지 모든 항목의 전제입니다.
   - **(A) 모듈화 진행**: `index.html`에 `src/main.js`를 연결 → 중복 구현된 `escapeHtml`·유틸부터 교체 → `vercel.json`의 `outputDirectory`를 `dist`로 전환 → Firebase 저장소를 이미 구현된 `supabaseService.js`로 이관 (H-1을 근본 해결)
   - **(B) 단일 파일 유지**: `src/`·`vite.config.js`·`tsconfig.json`을 삭제하고 README에 아키텍처를 명시. 대신 Firebase 규칙을 제대로 잠그는 데 집중
10. **생성 산출물을 Git에서 제거하고 빌드에 묶기** (L-1) — 사본 3벌 동기화 실패는 시간 문제입니다.
11. 마커 풀링 + in-flight 중복 제거 (M-10), SW 캐시 정책 정리 (M-7), CSP Report-Only 도입 (M-8)

---

### 검증에 사용한 명령

보고서의 주장은 아래 실측에 근거합니다.

```bash
npx jest                          # Tests: 3 failed, 44 passed, 47 total
npx eslint src/**/*.{js,ts}       # 24 problems (11 errors, 13 warnings)
npx tsc --noEmit                  # 통과 (단, src/만 검사 — index.html은 대상 외)
git ls-files | grep -c index.html # 3 (root, public/, www/)
md5 -q index.html public/index.html www/index.html   # 3개 해시 동일
```
