# 04. 예약 서류 자동 인식 & 바우처

> Triptic 3.0의 핵심 차별점. **정확도와 개인정보 보호가 기능 자체보다 중요하다.**

---

## 1. 절대 규칙

이 세 가지를 어기는 구현은 코드 리뷰에서 무조건 반려한다.

1. **조용한 자동 확정 금지.** 파싱 결과는 반드시 사용자 검수 시트를 거쳐야 일정에 반영된다.
2. **민감정보는 외부로 나가지 않는다.** 여권번호·카드번호·생년월일·주민등록번호는 LLM 호출 전에 제거한다.
3. **원문 텍스트를 저장하거나 로그에 남기지 않는다.** DB에는 마스킹된 구조화 결과와 해시만 남는다.

---

## 2. 전체 파이프라인

```
┌ 클라이언트 ──────────────────────────────────────────────┐
│ 1. 파일 선택 (PDF / JPG / PNG / .pkpass / .ics)          │
│ 2. 크기·형식 검사 (≤ 20MB, ≤ 30페이지)                   │
│ 3. 동의 화면 (최초 1회, 이후 설정에서 재확인 가능)         │
│ 4. Storage 직접 업로드 (서명 URL)                         │
│ 5. parse-booking Edge Function 호출                      │
└──────────────────────────────────────────────────────────┘
                          ↓
┌ Supabase Edge Function: parse-booking ───────────────────┐
│ A. 파일 로드 (같은 네트워크, 왕복 없음)                    │
│ B. 텍스트 추출                                            │
│    - PDF 텍스트 레이어 있음 → 그대로 사용                 │
│    - 없음(스캔본) → 페이지 이미지 렌더 → 비전 경로         │
│    - .pkpass → pass.json 직접 파싱 (LLM 불필요)          │
│    - .ics  → VEVENT 직접 파싱 (LLM 불필요)               │
│ C. 🔒 마스킹 (§5) ← 여기를 통과하지 않으면 다음 단계 없음  │
│ D. 결정론적 파서 시도 (§4) ─── 성공 ──┐                   │
│    ↓ 실패/부분 성공                   │                   │
│ E. LLM 구조화 추출 (§6)               │                   │
│    ↓                                  │                   │
│ F. 결정론적 검증 (§7) ←───────────────┘                   │
│    - IATA 공항 DB 대조 · 타임존 해석                      │
│    - 날짜가 여행 기간 내인지                              │
│    - 호텔명 → Google Places 좌표 해석                     │
│ G. 신뢰도 산출 → bookings 저장 (confirmed_by_user=false)  │
│ H. 임시 파일·텍스트 메모리에서 폐기                        │
└──────────────────────────────────────────────────────────┘
                          ↓
┌ 클라이언트 ──────────────────────────────────────────────┐
│ 6. 검수 시트 표시 (필드별 신뢰도 색상)                     │
│ 7. 사용자 확인/수정 → commit                              │
│ 8. itinerary_items 생성 + bookings.confirmed_by_user=true │
│ 9. 원본 = 바우처로 보관함에 등록                           │
└──────────────────────────────────────────────────────────┘
```

---

## 3. 입력 처리

### 3.1 지원 형식

| 형식 | 처리 |
|---|---|
| PDF (텍스트) | `pdfjs-dist`로 텍스트 레이어 추출. 위치 정보(x, y)도 보존 — 표 구조 복원에 필요 |
| PDF (스캔) | 페이지를 150dpi PNG로 렌더 → 비전 모델 |
| JPG / PNG | 비전 모델 직행 |
| `.pkpass` | ZIP 해제 → `pass.json`의 `boardingPass` 필드 직접 매핑. **LLM 불필요, 신뢰도 1.0** |
| `.ics` | `VEVENT`의 `DTSTART`/`DTEND`/`SUMMARY`/`LOCATION` 직접 매핑 |

### 3.2 사전 검사 (클라이언트)

```ts
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PAGES = 30;
const ACCEPTED = ['application/pdf','image/jpeg','image/png',
                  'application/vnd.apple.pkpass','text/calendar'];
```

초과 시 명확한 안내: "20MB를 넘는 파일은 올릴 수 없어요. 필요한 페이지만 잘라서 올려 주세요."

### 3.3 암호로 보호된 PDF

항공사 e-티켓은 생년월일이 암호인 경우가 있다. 암호 입력 프롬프트를 띄우고, **암호는 메모리에서만 쓰고 저장하지 않는다.**

---

## 4. 결정론적 파서 (1차)

LLM보다 **먼저** 시도한다. 정형 포맷은 규칙이 더 정확하고, 빠르고, 무료다.

### 4.1 구조

```
supabase/functions/parse-booking/parsers/
  index.ts              # 레지스트리: detect() 점수가 가장 높은 파서 선택
  flight/
    korean-air.ts       # KE
    asiana.ts           # OZ
    jeju-air.ts         # 7C
    jin-air.ts          # LJ
    tway.ts             # TW
    ana.ts              # NH
    jal.ts              # JL
    peach.ts            # MM
    vietjet.ts          # VJ
    generic-iata.ts     # IATA 표준 e-티켓 레이아웃 폴백
  lodging/
    agoda.ts
    booking-com.ts
    expedia.ts
    yanolja.ts
    interpark.ts
  rail/
    korail.ts
    jr-east.ts
  common/
    patterns.ts         # 공용 정규식 (IATA, 날짜, 시각, PNR)
```

### 4.2 파서 인터페이스

```ts
export interface BookingParser {
  id: string;                       // 'flight/korean-air'
  version: string;                  // 파서 버전 — bookings.parser_version에 기록
  /** 0~1. 0.7 이상이면 이 파서를 사용한다 */
  detect(text: string): number;
  parse(text: string, ctx: ParseContext): ParsedBooking[];
}

export interface ParseContext {
  tripStartDate: string;            // 날짜 모호성 해소에 사용
  tripEndDate: string;
  locale: 'ko' | 'en' | 'zh-CN';
  airports: AirportIndex;           // 번들 공항 DB
}
```

### 4.3 공용 패턴

```ts
// common/patterns.ts
export const IATA_AIRPORT = /\b([A-Z]{3})\b/g;
export const FLIGHT_NUMBER = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/g;
export const PNR = /\b([A-Z0-9]{6})\b/g;              // 후보만. 검증 필요
export const TIME_24H = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;

// 날짜는 로케일마다 다르다. 반드시 여러 형식을 시도하고 여행 기간으로 교차 검증한다.
export const DATE_PATTERNS = [
  /(\d{4})[-./](\d{1,2})[-./](\d{1,2})/,          // 2026-05-20
  /(\d{1,2})[-./](\d{1,2})[-./](\d{4})/,          // 20/05/2026 · 05/20/2026 ⚠️ 모호
  /(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{2,4})/i,
  /(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/,          // ja/zh
  /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/,          // ko
];
```

> **`DD/MM` vs `MM/DD` 모호성은 실제로 사고를 일으킨다.** `05/06/2026`은 5월 6일일 수도 6월 5일일 수도 있다. 해소 규칙:
> 1. 한쪽 숫자가 12를 넘으면 그쪽이 일(day)이다
> 2. 그래도 모호하면 **여행 기간 안에 들어가는 해석**을 택한다
> 3. 둘 다 기간 안이면 **신뢰도를 0.5로 낮추고 사용자에게 묻는다** — 임의로 고르지 않는다

---

## 5. 🔒 마스킹 (가장 중요)

LLM 호출 **직전**에 무조건 실행한다. 이 함수는 전용 단위 테스트를 가지며, 테스트 실패 시 배포가 막힌다.

```ts
// redact.ts
const RULES: Array<[RegExp, string]> = [
  // 여권번호 (한국 M12345678, 일반 2글자+7자리)
  [/\b[A-Z]{1,2}\d{7,8}\b/g,                    '[PASSPORT]'],
  // 신용카드 (13~19자리, 구분자 허용)
  [/\b(?:\d[ -]*?){13,19}\b/g,                  '[CARD]'],
  // 주민등록번호
  [/\b\d{6}[-\s]?[1-4]\d{6}\b/g,                '[NATIONAL_ID]'],
  // 생년월일 라벨 뒤 값
  [/\b(DOB|Date of Birth|생년월일|出生日期)\s*[:：]?\s*\S+/gi, '$1: [DOB]'],
  // 이메일
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g,              '[EMAIL]'],
  // 전화번호 (국제/국내)
  [/\+?\d{1,3}[-\s]?\(?\d{2,4}\)?[-\s]?\d{3,4}[-\s]?\d{4}\b/g, '[PHONE]'],
  // 마일리지·회원번호
  [/\b(FFP|Membership|회원번호|마일리지)\s*[:：]?\s*\S+/gi, '$1: [MEMBER_NO]'],
];

export function redact(text: string): { text: string; hits: string[] } {
  const hits: string[] = [];
  let out = text;
  for (const [re, rep] of RULES) {
    out = out.replace(re, (m, ...g) => {
      hits.push(rep.replace(/\$\d/g, ''));
      return typeof g[0] === 'string' && rep.includes('$1') ? rep.replace('$1', g[0]) : rep;
    });
  }
  return { text: out, hits };
}
```

### 5.1 승객 이름 처리

승객 이름은 예약 식별에 유용하지만 개인정보다. **기본은 마스킹하고**, 사용자가 설정에서 "예약자명도 인식"을 켠 경우에만 통과시킨다. 항공권 파싱 정확도에 영향은 없다 (이름은 편명·시각 추출에 쓰이지 않는다).

### 5.2 마스킹 테스트 (필수)

```ts
// redact.test.ts — 이 테스트가 깨지면 배포 불가
describe('redact', () => {
  const CASES = [
    ['Passport No: M12345678',            'M12345678'],
    ['여권번호 M87654321',                 'M87654321'],
    ['Card 4111-1111-1111-1111',          '4111'],
    ['카드 4111 1111 1111 1111',           '4111'],
    ['주민번호 900101-1234567',            '900101'],
    ['DOB: 1990-01-01',                   '1990-01-01'],
    ['email: a.b+c@example.co.kr',        'example.co.kr'],
    ['Tel +82-10-1234-5678',              '1234'],
  ];
  it.each(CASES)('%s 를 가린다', (input, secret) => {
    expect(redact(input).text).not.toContain(secret);
  });

  it('편명과 공항코드는 남긴다', () => {
    const { text } = redact('KE801 ICN 08:00 NRT 11:00 2026-05-20');
    expect(text).toContain('KE801');
    expect(text).toContain('ICN');
    expect(text).toContain('08:00');
  });
});
```

> ⚠️ 카드번호 정규식(13~19자리)은 **편명이나 예약번호를 잘못 가릴 수 있다.** 위 마지막 테스트가 그것을 막는다. 규칙을 수정할 때마다 양방향(가려야 할 것 / 남겨야 할 것)을 모두 검증한다.

---

## 6. LLM 구조화 추출 (2차)

### 6.1 공급자 전략

기존 `api/recommend.js`의 폴백 패턴을 재사용한다.

| 순위 | 모델 | 용도 |
|---|---|---|
| 1 | **Gemini 2.5 Flash** | 기본. 구조화 출력(`responseSchema`) 지원, PDF/이미지 네이티브 처리, 무료 티어 있음 |
| 2 | Groq (Llama 3.3 70B) | 텍스트 전용 폴백. 매우 빠름 |
| 3 | OpenRouter | 최종 폴백 |
| 4 | 실패 | 검수 시트를 **빈 수동 입력 폼**으로 띄운다 (기능이 죽지 않게) |

전체 예산 **20초**. Vercel이 아닌 Supabase Edge Function이라 10초 제한에 묶이지 않는다.

### 6.2 요청 규칙

- `temperature: 0` (추출 작업에 창의성은 해롭다)
- `responseSchema`로 JSON 구조를 강제한다
- 결정론적 파서가 찾은 값은 **힌트로 함께 전달**한다 ("이 값들은 규칙 기반으로 확인됨")
- 스키마 검증 실패 시 1회만 재시도. 2회 실패는 실패로 처리

### 6.3 프롬프트 (요지)

```
You extract travel booking data from documents. Rules:

1. Output JSON matching the provided schema. No prose, no markdown.
2. NEVER invent values. If a field is not clearly present, use null.
3. Times printed on tickets are LOCAL times at that location.
   Return them as "YYYY-MM-DDTHH:mm" with NO timezone offset.
4. Return an IATA code only if it is explicitly printed. Do not guess
   a code from a city name.
5. For each field, return a confidence 0.0–1.0 reflecting how directly
   the value was stated in the document. Lower it when you inferred.
6. Some values are redacted as [PASSPORT], [CARD], [EMAIL] etc.
   Treat them as absent. Do not attempt to reconstruct them.
7. A document may contain multiple bookings (round trip, multi-leg).
   Return every one of them.

Verified hints from rule-based parsing (trust these over your own reading):
{{hints}}

Trip context: {{tripStart}} to {{tripEnd}}
```

> 규칙 4번이 중요하다. 모델은 "Tokyo"를 보면 `HND`나 `NRT`를 지어낸다. 두 공항은 도심에서 이동 시간이 1시간 이상 차이 나므로 일정이 완전히 망가진다.

### 6.4 출력 스키마 (Zod — 서버·클라 공용)

```ts
export const Confidence = z.number().min(0).max(1);
const F = <T extends z.ZodTypeAny>(v: T) =>
  z.object({ value: v.nullable(), confidence: Confidence });

export const ParsedFlight = z.object({
  kind: z.literal('flight'),
  carrierIata:   F(z.string().regex(/^[A-Z0-9]{2}$/)),
  carrierName:   F(z.string()),
  flightNumber:  F(z.string().regex(/^[A-Z0-9]{2}\d{1,4}$/)),
  departure: z.object({
    airportIata: F(z.string().length(3)),
    airportName: F(z.string()),
    terminal:    F(z.string()),
    scheduledLocal: F(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
  }),
  arrival: z.object({
    airportIata: F(z.string().length(3)),
    airportName: F(z.string()),
    terminal:    F(z.string()),
    scheduledLocal: F(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
  }),
  bookingReference: F(z.string()),
  seat:             F(z.string()),
  cabinClass:       F(z.enum(['economy','premium_economy','business','first'])),
});

export const ParsedLodging = z.object({
  kind: z.literal('lodging'),
  propertyName: F(z.string()),
  address:      F(z.string()),
  checkInLocal:  F(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
  checkOutLocal: F(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)),
  roomType:     F(z.string()),
  guestCount:   F(z.number().int().positive()),
  bookingReference: F(z.string()),
  phone:        F(z.string()),
});

export const ParsedBooking = z.discriminatedUnion('kind', [
  ParsedFlight, ParsedLodging, ParsedRail, ParsedCarRental, ParsedActivity,
]);

export const ParseResponse = z.object({
  documentId: z.string().uuid(),
  bookings: z.array(ParsedBooking),
  parserUsed: z.string(),          // 'flight/korean-air@1.2' 또는 'llm/gemini-2.5-flash'
  warnings: z.array(z.string()),
});
```

---

## 7. 결정론적 검증 (3차) — 환각 방어선

LLM 출력을 **그대로 믿지 않는다.** 아래를 모두 통과해야 신뢰도를 유지한다.

| 검증 | 방법 | 실패 시 |
|---|---|---|
| IATA 코드 실재 | 번들 `airports.json` 조회 | 해당 필드 신뢰도 0으로, 빈칸 처리 |
| 공항 좌표·타임존 | 번들 DB에서 가져옴 (LLM 값 사용 안 함) | — |
| 편명 형식 | `^[A-Z0-9]{2}\d{1,4}$` | 신뢰도 0.3으로 감점 |
| 도착 > 출발 | 타임존 적용 후 UTC 비교 | 신뢰도 0.4, 경고 표시 |
| 비행시간 타당성 | 대권거리 기반 예상시간의 0.6~2.0배 | 신뢰도 0.5, 경고 |
| 날짜가 여행 기간 내 | `tripStart-1일 ~ tripEnd+1일` | 신뢰도 0.5 + "다른 여행의 예약인가요?" |
| 체크아웃 > 체크인 | 날짜 비교 | 신뢰도 0.4 |
| 호텔 좌표 | Google Places Text Search로 해석 | 좌표 없으면 사용자에게 검색 요청 |

### 7.1 공항 DB

```
data/airports.json   (약 7,000개, gzip 후 약 350KB)
{
  "ICN": { "name":"Incheon Intl","city":"Seoul","country":"KR",
           "lat":37.4692,"lng":126.4505,"tz":"Asia/Seoul" },
  ...
}
```

출처: OurAirports (퍼블릭 도메인). 분기마다 갱신하는 스크립트(`scripts/update-airports.ts`)를 둔다.
**aviationstack에 공항 좌표를 의존하지 않는다** — 네트워크 실패에 취약하고 호출 한도를 먹는다.

### 7.2 타임존 변환

```ts
import { fromZonedTime } from 'date-fns-tz';

// 티켓에 인쇄된 "2026-05-20T08:00"은 ICN 현지 시각
const depTz = airports['ICN'].tz;                     // 'Asia/Seoul'
const depUtc = fromZonedTime('2026-05-20T08:00', depTz);

const arrTz = airports['NRT'].tz;                     // 'Asia/Tokyo'
const arrUtc = fromZonedTime('2026-05-20T11:00', arrTz);

const durationMin = (arrUtc.getTime() - depUtc.getTime()) / 60000;  // 120분 ✅
// ⚠️ 타임존을 무시하면 180분으로 계산된다 (한국↔일본 시차 없음에도 흔한 버그)
```

---

## 8. 신뢰도 산출

```
최종 신뢰도 = min(추출 신뢰도, 검증 점수) × 출처 가중치

출처 가중치:
  .pkpass / .ics 직접 파싱  1.00
  결정론적 파서 (detect≥0.9) 0.98
  결정론적 파서 (detect≥0.7) 0.92
  LLM (텍스트)              0.85
  LLM (스캔 이미지)          0.75
```

UI 반영은 [`01-design-system.md` §6.6](01-design-system.md) 참조:
`≥0.9` 정상 · `0.8~0.9` 확인 요청 · `<0.8` 빈칸 + 원본 보기

---

## 9. 일정 반영 규칙 (commit)

사용자가 검수 시트에서 확정하면:

| 예약 타입 | 생성되는 항목 |
|---|---|
| flight | `type='flight'` 1건, 출발일 Day에 배치. 도착지 공항이 다른 Day면 도착 항목도 생성 |
| lodging | 체크인 Day에 `type='lodging'`, 체크아웃 Day에도 `type='lodging'` (subtitle: 체크아웃). **중간 일자에는 만들지 않는다** (타임라인이 지저분해진다) |
| rail | 출발 Day에 `type='transport'` |
| car_rental | 픽업/반납 Day에 각각 `type='transport'` |
| activity | 해당 Day에 `type='activity'` |
| restaurant | 해당 Day에 `type='meal'` |

**배치 위치**: 같은 Day 안에서 `start_local` 순으로 삽입한다. 시각이 없으면 맨 뒤.

**충돌 처리**: 이미 같은 `reference_code`의 예약이 있으면 새로 만들지 않고 "이미 등록된 예약입니다 — 업데이트할까요?"를 띄운다.

**여행 기간 밖**: 예약 날짜가 여행 기간을 벗어나면 "여행 기간을 늘릴까요?"를 제안한다. 임의로 늘리지 않는다.

---

## 10. 바우처 보관함

### 10.1 저장

- 경로: `vouchers/{user_id}/{trip_id}/{document_id}.{ext}`
- 비공개 버킷. 접근은 항상 **5분 만료 서명 URL**
- 업로드 시 클라이언트에서 이미지 EXIF 제거

### 10.2 오프라인 캐시

여행 시작 **3일 전** 자동으로 해당 여행의 모든 바우처를 다운로드해 Cache Storage에 보관한다.

```ts
// 캐시 키: voucher:{documentId}
// 기기 캐시 한도: 500MB (3.0은 과금이 없으므로 티어 구분 없음)
// 초과 시: 오래된 여행 순으로 제거 (LRU)
```

설정에서 "여행 전 자동 다운로드"를 끌 수 있다. 기내·로밍 없는 환경에서 바우처를 못 여는 것이 이 기능의 유일한 실패 모드이므로, **다운로드 완료 여부를 바우처 목록에 아이콘으로 표시**한다.

### 10.3 뷰어

- PDF: `pdfjs-dist`, 핀치 줌, 페이지 썸네일
- 이미지: 핀치 줌
- **화면 밝기 자동 최대화** (QR/바코드 스캔 대비) — Capacitor 플러그인
- 공유(시스템 시트), Apple Wallet 추가(.pkpass), 삭제

---

## 11. 골든 테스트 (정확도 보증)

### 11.1 구성

```
tests/fixtures/bookings/
  flight/
    ke801-ko.txt        # 마스킹 후 텍스트
    ke801-ko.expected.json
    oz102-en.txt
    ...
  lodging/
    agoda-tokyo.txt
    ...
  manifest.json         # 각 케이스의 출처·수집일·동의 여부
```

### 11.2 수집 원칙

- **실제 사용자 문서를 무단 사용하지 않는다.** 팀원 본인 예약 + 공개 샘플 + 합성 문서로 구성한다.
- 사용자에게 문서 기부를 받을 경우 별도 명시적 동의를 받고, 마스킹 후에만 저장한다.
- 픽스처는 **마스킹된 텍스트만** 커밋한다. 원본 PDF는 저장소에 넣지 않는다.

### 11.3 목표치 (CI에서 강제)

| 카테고리 | 최소 케이스 | 필드 정확도 |
|---|---|---|
| 항공 (상위 10개 항공사) | 50 | **≥ 95%** |
| 항공 (기타) | 15 | ≥ 85% |
| 숙소 (주요 5개 OTA) | 25 | **≥ 90%** |
| 철도·렌터카·액티비티 | 10 | ≥ 80% |

```ts
// accuracy.test.ts
// 필드 정확도 = (정확히 일치한 필드 수) / (기대 JSON의 non-null 필드 수)
// 시각은 분 단위 일치, 문자열은 정규화 후 비교
expect(fieldAccuracy('flight/major')).toBeGreaterThanOrEqual(0.95);
```

정확도가 기준 밑으로 떨어지면 CI가 실패한다. **모델이나 프롬프트를 바꾼 뒤 이 테스트를 돌리지 않고 머지하는 것을 금지한다.**

---

## 11.5 남용 방어 한도 (과금이 아님)

3.0에는 유료 티어가 없다. 그러나 서류 파싱은 **호출당 실제 비용이 발생하는 유일한 기능**이므로 무제한으로 열어 둘 수 없다.

| 항목 | 한도 | 근거 |
|---|---|---|
| 파싱 요청 | 사용자당 **하루 30건** | 여행 1건당 서류는 보통 5~10건. 정상 사용자는 도달하지 않는다 |
| 문서 크기 | 20MB | |
| 페이지 수 | 30페이지 | |
| 바우처 총 저장량 | 사용자당 **500MB** | |
| 동시 처리 | 사용자당 3건 | 큐잉으로 처리 |

구현:

```ts
const used = await usageInWindow(userId, 'document.parse', '24 hours');
if (used >= 30) {
  await recordUsage(userId, 'limit.reached', { kind: 'document.parse' });
  return err('RATE_LIMITED');   // 에러 코드로 반환 (07-i18n §6)
}
```

**사용자에게 보이는 문구는 "유료로 전환하세요"가 아니라 "오늘은 여기까지예요. 내일 다시 시도해 주세요"다.** 3.0에서 이 한도는 수익화 장치가 아니라 비용 방어선이다.

`limit.reached` 이벤트를 모니터링해, 정상 사용자가 걸리기 시작하면 한도를 올린다.

## 12. 비용·성능 목표

| 지표 | 목표 |
|---|---|
| 문서 1건 처리 시간 (텍스트 PDF) | p50 ≤ 4초, p95 ≤ 12초 |
| 문서 1건 처리 시간 (스캔) | p95 ≤ 25초 |
| 문서 1건 LLM 비용 | ≤ $0.003 |
| 결정론적 파서로만 처리된 비율 | ≥ 45% (LLM 호출 자체를 줄이는 것이 최선의 비용 절감) |
| 파싱 실패율 | ≤ 5% |

---

## 13. 향후 확장 (3.0 이후)

- **이메일 전달 자동 등록**: 사용자별 고유 주소(`trip-a1b2c3@in.triptic.my`)로 예약 메일을 전달하면 자동 파싱. 진입 마찰이 사라진다. 구현: Cloudflare Email Routing 또는 Postmark 인바운드 → 같은 파이프라인 재사용.
- **캘린더 연동**: iOS 캘린더에서 항공편 이벤트 감지
- **항공편 변경 추적**: 등록된 편명을 aviationstack으로 주기 조회 → 지연·게이트 변경 푸시
