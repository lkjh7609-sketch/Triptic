# 05. 날씨

> 요구사항: **위치를 등록하면 그 옆에 현재 기온을 표시**하고, 일자 헤더에는 최고/최저를 보여준다.

---

## 1. 공급자 선정

### 1.1 결론: Apple WeatherKit REST API

| 후보 | 비용 | 상업적 이용 | 판정 |
|---|---|---|---|
| **Apple WeatherKit** | Apple Developer Program($99/년)에 **월 50만 호출 포함**. 초과 시 100만 건당 $49.99 | 가능 | ✅ **채택** |
| Open-Meteo 무료 | 무료 (10,000 호출/일) | ❌ **비상업적 이용으로 제한** | 부적합 |
| Open-Meteo 유료 | $29/월~ | 가능 | 대안 (웹 전용 폴백) |
| OpenWeatherMap | 무료 티어 있음 / 유료 | 가능 | 대안 |

**채택 이유**: App Store에 출시하려면 Apple Developer Program 가입이 **어차피 필수**다. 거기 포함된 50만 호출은 실질적으로 추가 비용 0이며, 캐싱을 하면 10,000 MAU까지 충분하다.

> ⚠️ **Open-Meteo 무료 티어를 쓰면 안 된다.** 이용약관상 비상업적 용도로 제한되어 있고, 유료 앱/스토어 출시 앱은 여기에 해당하지 않는다. 라이선스 위반은 서비스 중단 리스크다.

### 1.2 폴백

WeatherKit 장애 시 **날씨를 숨긴다**. 다른 공급자로 즉시 전환하지 않는다 — 공급자마다 기상 코드 체계가 달라 같은 날씨가 다르게 보이면 신뢰를 잃는다. 대신 캐시된 마지막 값을 "N시간 전 기준"으로 표시한다.

---

## 2. 인증 (WeatherKit REST)

WeatherKit REST는 **ES256으로 서명한 JWT**를 요구한다. 이 서명은 반드시 서버에서 한다.

### 2.1 필요한 값 (Apple Developer 포털에서 발급)

| 항목 | 설명 |
|---|---|
| Team ID | 10자리 |
| Service ID | 예: `com.triptic.travel.weather` |
| Key ID | WeatherKit용 키의 ID |
| Private Key (.p8) | **서버 환경변수에만.** 저장소 커밋 절대 금지 |

### 2.2 서버 환경변수

```
WEATHERKIT_TEAM_ID=
WEATHERKIT_SERVICE_ID=
WEATHERKIT_KEY_ID=
WEATHERKIT_PRIVATE_KEY=   # .p8 내용 (개행은 \n으로 이스케이프)
```

`api/env.ts`가 이 값들을 **절대 클라이언트로 내려보내지 않도록** 주의한다. 기존 코드가 `AVIATIONSTACK_API_KEY`를 제외한 것과 같은 원칙이다.

### 2.3 JWT 생성

```ts
// api/weather.ts (Vercel Serverless)
import { SignJWT, importPKCS8 } from 'jose';

async function weatherKitToken(): Promise<string> {
  const key = await importPKCS8(
    process.env.WEATHERKIT_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: process.env.WEATHERKIT_SERVICE_ID! })
    .setProtectedHeader({
      alg: 'ES256',
      kid: process.env.WEATHERKIT_KEY_ID!,
      id: `${process.env.WEATHERKIT_TEAM_ID}.${process.env.WEATHERKIT_SERVICE_ID}`,
    })
    .setIssuer(process.env.WEATHERKIT_TEAM_ID!)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}
```

토큰은 1시간 유효하므로 **인스턴스 메모리에 캐시**한다 (매 요청 서명은 낭비다).

---

## 3. API 설계

### 3.1 엔드포인트

```
GET /api/weather?lat=35.6762&lng=139.6503&start=2026-05-20&end=2026-05-23&lang=ko
```

**요청을 항목 단위가 아니라 여행 단위로 묶는다.** 일정에 항목이 20개 있어도 호출은 1~2번이다.

### 3.2 응답

```jsonc
{
  "gridKey": "35.68,139.65",
  "source": "forecast",            // forecast | climate_normal | cache
  "fetchedAt": "2026-05-18T10:00:00Z",
  "current": {                      // start가 오늘일 때만
    "tempC": 23.1,
    "condition": "Clear",
    "conditionCode": "clear",       // §4 매핑 후 코드
    "isDaylight": true
  },
  "daily": [
    { "date": "2026-05-20", "tempMinC": 16.2, "tempMaxC": 23.4,
      "conditionCode": "clear", "precipChance": 0.1 },
    { "date": "2026-05-21", "tempMinC": 17.0, "tempMaxC": 24.1,
      "conditionCode": "partly_cloudy", "precipChance": 0.2 }
  ],
  "hourly": [                       // 오늘~내일만 (항목별 기온 표시용)
    { "time": "2026-05-20T13:00:00Z", "tempC": 21.0, "conditionCode": "clear" }
  ]
}
```

### 3.3 캐시

| 계층 | TTL | 키 |
|---|---|---|
| 클라이언트 (TanStack Query) | 30분 | `['weather', gridKey, start, end]` |
| CDN (`Cache-Control`) | `s-maxage=1800, stale-while-revalidate=86400` | URL |
| DB (`weather_cache`) | 현재 1시간 / 예보 3시간 | `(grid_key, date, provider)` |

**격자 키**: `round(lat,2)`,`round(lng,2)` → 약 1.1km 격자. 도쿄 시내 일정 10개가 대부분 같은 키로 묶여 호출이 1회로 줄어든다.

```ts
export const gridKey = (lat: number, lng: number) =>
  `${lat.toFixed(2)},${lng.toFixed(2)}`;
```

**목표**: 캐시 적중률 ≥ 80%, 사용자당 하루 실제 API 호출 ≤ 10회.

---

## 4. 기상 코드 매핑

WeatherKit의 `conditionCode`는 40종이 넘는다. UI에서는 **9종**으로 압축한다.

| 내부 코드 | 아이콘 | WeatherKit 원본 (예시) |
|---|---|---|
| `clear` | ☀️ | Clear, MostlyClear |
| `partly_cloudy` | 🌤 | PartlyCloudy |
| `cloudy` | ☁️ | Cloudy, MostlyCloudy |
| `fog` | 🌫 | Foggy, Haze, Smoky |
| `rain` | 🌧 | Rain, Drizzle, HeavyRain, Showers |
| `thunderstorm` | ⛈ | Thunderstorms, IsolatedThunderstorms |
| `snow` | ❄️ | Snow, Flurries, HeavySnow, Sleet, Blizzard |
| `wind` | 💨 | Windy, BreezyStrongWinds |
| `unknown` | — | 그 외 |

매핑 테이블은 `src/features/weather/conditionMap.ts` 한 곳에만 둔다. 매핑되지 않은 코드가 들어오면 `unknown`으로 처리하고 **Sentry에 경고를 보낸다** (Apple이 코드를 추가할 수 있다).

야간에는 `isDaylight=false`일 때 달 아이콘 변형을 쓴다 (☀️→🌙, 🌤→☁️🌙).

---

## 5. 예보 범위를 넘는 날짜 ⭐

**이것이 여행 앱에서 날씨를 다룰 때 가장 흔한 버그다.** 사용자는 3개월 뒤 여행을 계획하는데, 예보는 10일치밖에 없다.

### 5.1 규칙

| 여행 시작일까지 | 표시 |
|---|---|
| ≤ 10일 | 실제 예보. 그대로 표시 |
| > 10일 | **기후 평년값** + 명확한 라벨: `평년 17°/24°` (아이콘 옆 작은 "평년" 배지) |
| 과거 여행 | 실제 관측값 (있으면) 또는 표시 안 함 |

절대 하지 말 것:
- 평년값을 예보처럼 보여주기 (사용자가 우산을 안 챙긴다)
- 데이터가 없다고 `0°` 또는 `--°` 표시하기 → **영역 자체를 비운다**

### 5.2 기후 평년값 확보

`climate_normals` 테이블을 **직접 구축**한다. 이렇게 하면 외부 API 라이선스 문제에서 자유롭다.

```
출처: ERA5 재분석 데이터 (Copernicus, 무료/재배포 가능) 또는
      NOAA GHCN 월별 평년값 (퍼블릭 도메인)
방법: 1회 ETL로 주요 여행 도시 500곳의 월별 tmin/tmax/강수량을 추출 →
      climate_normals에 적재 (grid_key, month)
갱신: 연 1회
```

해당 격자에 평년값이 없으면 **가장 가까운 격자**(반경 50km 내)를 쓰고, 그것도 없으면 날씨를 표시하지 않는다.

---

## 6. UI 규칙

### 6.1 일자 헤더

```
Day 1   5/20 (수)   ☀️ 16°/23°        편집
```

- `최저°/최고°` 순서 (한국 관행)
- 단위는 `profiles.temp_unit` 따름 (°C/°F)

### 6.2 일정 항목

```
② 13:00  4성급 호텔          ☀️
   다이이치 호텔 도쿄          25°
```

- **항목 시각의 시간별 기온**을 쓴다 (일 평균이 아니라). 시각이 없으면 그날 최고기온.
- `hourly`가 커버하지 않는 날짜(모레 이후)는 **항목별 기온을 표시하지 않고** 일자 헤더의 최고/최저만 보여준다. 억지로 채우지 않는다.

### 6.3 로딩·실패

- 로딩: 기온 자리에 회색 스켈레톤 (숫자 깜빡임 금지)
- 실패: 아무것도 표시하지 않음. 에러 토스트도 띄우지 않는다 (날씨는 보조 정보다)
- 오프라인: 캐시 값 + "3시간 전 기준" 캡션

---

## 7. 짐싸기 추천 연계 (P2 기능)

날씨 데이터를 한 번 더 쓴다.

| 조건 | 추천 |
|---|---|
| 최고기온 ≥ 28°C | 반팔, 선크림, 모자 |
| 최저기온 ≤ 5°C | 패딩, 장갑, 목도리 |
| 일교차 ≥ 12°C | 얇은 겉옷 |
| 강수 확률 ≥ 40% (하루 이상) | 우산, 방수 신발 |
| 눈 예보 | 미끄럼 방지 신발 |

여행 기간 전체를 스캔해 중복 없이 목록을 만든다.

---

## 8. 테스트

```ts
describe('weather', () => {
  it('11일 뒤 날짜는 평년값 소스로 표시한다', ...);
  it('평년값에는 반드시 climate 라벨이 붙는다', ...);
  it('데이터 없으면 0°가 아니라 빈 영역을 렌더한다', ...);
  it('gridKey는 1.1km 격자로 반올림한다', () => {
    expect(gridKey(35.676234, 139.650311)).toBe('35.68,139.65');
    expect(gridKey(35.681000, 139.653000)).toBe('35.68,139.65'); // 같은 키
  });
  it('매핑 없는 conditionCode는 unknown + 경고', ...);
  it('°F 설정이면 화씨로 변환한다', ...);
});
```
