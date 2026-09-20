# 01. 디자인 시스템

> 참조 이미지는 **레이아웃 구조**의 참고일 뿐이다. 색·모양을 그대로 베끼지 않고 Triptic의 정체성(딥 오션 네이비 + 웜 뉴트럴)을 발전시킨다.

---

## 1. 원칙

1. **지도가 주인공이다.** UI 크롬은 지도와 일정을 가리지 않는다. 채도 높은 색은 액션과 마커에만 쓴다.
2. **정보 밀도 > 여백 미학.** 여행 중에는 한 화면에 많은 정보가 보여야 한다. 단, 계층은 타이포로 만든다.
3. **모든 색은 대비 검증을 통과한다.** 토큰을 추가할 때 WCAG 대비비를 계산해 주석으로 남긴다.
4. **다크 모드는 부가 기능이 아니다.** 기내·야간 이동 중 사용 빈도가 높다.

---

## 2. 색 토큰

아래 대비비는 실제 계산값이다 (WCAG 2.1 상대 휘도 공식).

### 2.1 라이트 모드

```css
:root {
  /* 표면 */
  --surface-page:     #FBFBF9;  /* 웜 오프화이트 (기존 #F9F9F7 계승) */
  --surface-card:     #FFFFFF;
  --surface-subtle:   #F1F2EF;  /* 칩·태그 배경 */
  --surface-sunken:   #E8EAE5;  /* 입력 비활성, 스켈레톤 */
  --surface-overlay:  rgba(17, 24, 39, 0.48);

  /* 텍스트 — 모두 --surface-page 기준 */
  --text-primary:     #111827;  /* 17.12:1  AAA */
  --text-body:        #334155;  /*  9.99:1  AAA */
  --text-muted:       #64748B;  /*  4.59:1  AA  */
  --text-placeholder: #94A3B8;  /* 플레이스홀더 전용. 본문 금지 */
  --text-on-brand:    #FFFFFF;

  /* 브랜드 */
  --brand:            #2B4EE6;  /*  6.08:1 on page / 흰 글자 6.30:1  AA */
  --brand-pressed:    #1E3BC4;
  --brand-tint:       #EEF2FF;  /* 선택된 칩 배경 */

  /* 지도 마커 — 흰 숫자를 올리므로 4.5:1 이상 필요 */
  --marker-fill:      #15803D;  /* 흰 글자 5.02:1  AA ✅ */
  --marker-fill-active: #2B4EE6;
  --route-transit:    #2B4EE6;  /* 대중교통 경로 폴리라인 */
  --route-fallback:   #64748B;  /* 직선 점선 폴백 */

  /* 상태 */
  --success:          #0B7A55;  /* 흰 글자 5.34:1  AA */
  --success-tint:     #E7F6F0;
  --warning:          #9A3412;  /* 낮은 신뢰도 필드 강조 */
  --warning-tint:     #FFF4E5;
  --danger:           #B91C1C;  /*  6.24:1  AA */
  --danger-tint:      #FEECEC;

  /* 경계 */
  --border:           #E2E5E1;
  --border-strong:    #CBD5E1;
  --border-focus:     #2B4EE6;
}
```

### 2.2 다크 모드

```css
:root[data-theme="dark"] {
  --surface-page:     #0E1116;
  --surface-card:     #171B22;
  --surface-subtle:   #1F242D;
  --surface-sunken:   #262C36;
  --surface-overlay:  rgba(0, 0, 0, 0.62);

  --text-primary:     #E8EAF0;  /* 15.72:1 on page / 14.35:1 on card  AAA */
  --text-body:        #B3BAC7;  /*  9.69:1  AAA */
  --text-muted:       #8892A4;
  --text-placeholder: #6B7486;
  --text-on-brand:    #0E1116;

  --brand:            #8AA4FF;  /*  7.96:1  AAA */
  --brand-pressed:    #A7BBFF;
  --brand-tint:       #1B2440;

  --marker-fill:      #34D399;
  --marker-fill-active: #8AA4FF;
  --route-transit:    #8AA4FF;
  --route-fallback:   #8892A4;

  --success:          #34D399;
  --success-tint:     #12301F;
  --warning:          #FBBF24;
  --warning-tint:     #3A2A0A;
  --danger:           #F87171;
  --danger-tint:      #3A1616;

  --border:           #2A303B;
  --border-strong:    #3A424F;
  --border-focus:     #8AA4FF;
}
```

> **다크 모드에서 흰 글자를 브랜드색 위에 올리지 말 것.** `--brand`가 밝아졌으므로 `--text-on-brand`는 어두운 색이다.

### 2.3 테마 적용 규칙

```css
/* 시스템 설정 따름 (기본) */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* 위 다크 토큰 */ }
}
/* 사용자가 설정에서 명시적으로 고른 경우 */
:root[data-theme="dark"] { /* 다크 */ }
```

`<html data-theme="system|light|dark">`를 설정 화면에서 제어한다. Capacitor StatusBar 스타일도 함께 전환한다.

---

## 3. 타이포그래피

### 3.1 폰트

| 로케일 | 폰트 스택 |
|---|---|
| ko, en | `"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif` |
| **zh-CN** | `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif` |

> ⚠️ **Pretendard는 간체 중국어 글리프를 충분히 포함하지 않는다.** zh 로케일에서 Pretendard만 쓰면 글자가 시스템 폴백으로 빠지며 두께·자간이 어긋난다. `zh-CN` 선택 시에만 Noto Sans SC를 **동적 로드**한다 (초기 번들에 넣지 말 것 — 서브셋이라도 수백 KB다).

### 3.2 스케일

| 토큰 | 크기 / 행간 | 굵기 | 용도 |
|---|---|---|---|
| `--font-display` | 28 / 34 | 800 | 대시보드 숫자, 화면 제목 |
| `--font-title` | 20 / 28 | 700 | 섹션 제목, 여행명 |
| `--font-headline` | 17 / 24 | 600 | 일정 항목 이름 |
| `--font-body` | 15 / 22 | 400 | 본문, 메모 |
| `--font-label` | 13 / 18 | 500 | 카테고리, 보조 설명 |
| `--font-caption` | 11 / 14 | 500 | 구간 거리 라벨, 타임스탬프 |

**Dynamic Type 대응**: 위 값은 `rem` 기준으로 정의하고, iOS 시스템 글자 크기 설정을 따른다. 최대 확대 시(200%) 레이아웃이 깨지지 않는지 Phase 6에서 검증한다.

### 3.3 줄바꿈 (다국어 주의)

```css
/* ❌ 현재 코드: 전역 적용 → 중국어 깨짐 */
* { word-break: keep-all; }

/* ✅ 로케일별 분기 */
:root:lang(ko) { word-break: keep-all; line-break: strict; }
:root:lang(en) { word-break: normal; overflow-wrap: break-word; }
:root:lang(zh) { word-break: normal; line-break: normal; }
```

---

## 4. 간격·모서리·그림자

```css
:root {
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;
  --space-4: 16px; --space-5: 20px; --space-6: 24px;
  --space-8: 32px; --space-10: 40px;

  --radius-sm: 8px;    /* 칩, 작은 버튼 */
  --radius-md: 12px;   /* 입력, 일정 카드 */
  --radius-lg: 16px;   /* 큰 카드, 모달 */
  --radius-xl: 24px;   /* 바텀시트 상단 */
  --radius-pill: 9999px;

  --shadow-sm: 0 1px 2px rgba(17,24,39,.06), 0 1px 3px rgba(17,24,39,.04);
  --shadow-md: 0 4px 12px rgba(17,24,39,.08);
  --shadow-lg: 0 12px 32px rgba(17,24,39,.14);
  --shadow-sheet: 0 -8px 28px rgba(17,24,39,.12);
}
```

다크 모드에서는 그림자 대신 `--border`로 층위를 표현한다 (어두운 배경에서 그림자는 보이지 않는다).

---

## 5. 레이아웃

### 5.1 안전 영역

```css
.app-shell {
  padding-top: env(safe-area-inset-top);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
.tab-bar {
  padding-bottom: env(safe-area-inset-bottom);
  height: calc(56px + env(safe-area-inset-bottom));
}
```

스크롤 컨테이너 하단에는 `padding-bottom: calc(56px + env(safe-area-inset-bottom) + var(--space-4))`를 두어 탭바에 콘텐츠가 가리지 않게 한다.

### 5.2 반응형 기준

| 브레이크포인트 | 대상 | 레이아웃 |
|---|---|---|
| `< 480px` | 휴대폰 | 기본. 단일 컬럼, 지도/목록 토글 |
| `480–900px` | 큰 폰·작은 태블릿 | 동일하되 카드 최대 폭 제한 |
| `> 900px` | 태블릿·웹 | 계획 탭을 좌우 분할 (좌: 타임라인 400px, 우: 지도) |

> 기존 앱의 데스크톱 좌우 분할 레이아웃은 유지한다. 모바일에서만 토글이다.

---

## 6. 핵심 컴포넌트

### 6.1 탭바 (`<TabBar>`)

- 높이 56px + 안전영역. `--surface-card` 배경, 상단 1px `--border`.
- 항목 4개: 홈 / 계획 / 커뮤니티 / 설정. 아이콘 24px + 라벨 11px.
- 활성: 아이콘·라벨 `--brand`, 비활성 `--text-muted`.
- **접근성**: `role="tablist"`, 각 항목 `role="tab"` + `aria-selected`. 터치 타깃 최소 44×44pt.
- 지도 전체화면 모드에서는 탭바를 숨기지 **않는다** (사용자가 길을 잃는다). 대신 바텀시트를 탭바 위에 띄운다.

### 6.2 일정 항목 카드 (`<ItineraryItemCard>`)

```
┌─────────────────────────────────────────────┐
│ ⑴  13:00  4성급 호텔                    ☀️  │   ← 시간(브랜드색) · 카테고리(muted)
│    다이이치 호텔 도쿄                    21°  │   ← 이름(headline) · 기온
│    🔍 체크인 후 짐 보관                       │   ← 메모(label, muted)
└─────────────────────────────────────────────┘
```

- 좌측 번호 마커: 28px 원, `--marker-fill`, 흰 숫자 13px/700 (대비 5.02:1)
- 항공편 항목은 번호 대신 ✈️ 아이콘 + `--brand-tint` 배경
- 우측 날씨: 아이콘 20px + 기온 15px/600. **기온이 없으면 영역 자체를 비운다** (0°로 표시 금지)
- 탭 → 상세 시트, 길게 누르기 → 순서 변경 모드

### 6.3 구간 라벨 (`<LegLabel>`)

항목 사이 연결선 위에 표시. `73.2km` / `900m` / `도보 12분`.

- 값이 **아직 로딩 중**이면 스켈레톤(회색 바). `0km`나 `-`로 표시하지 않는다.
- 경로 조회 실패 시 직선거리(Haversine)를 `≈` 접두사와 함께 표시한다. 예: `≈ 1.2km`
- 탭하면 Google Maps 길찾기 딥링크 (기존 `buildDeepLinkHTML` 동작 유지)

### 6.4 Day 칩 (`<DayChips>`)

- 가로 스크롤. 활성 칩: `--brand-tint` 배경 + `--brand` 텍스트 + 1px `--brand` 보더
- 비활성: `--surface-card` + `--border`
- 활성 칩은 선택 시 뷰포트 안으로 자동 스크롤 (`scrollIntoView({inline:'center'})`)
- 일차가 7일을 넘으면 기존의 페이지네이션 대신 **단순 가로 스크롤 + 스냅**으로 단순화한다

### 6.5 바텀시트 (`<BottomSheet>`)

- 스냅 포인트 3단: `peek(30%)` / `half(60%)` / `full(92%)`
- 드래그 핸들 36×4px, `--border-strong`
- **iOS Safari 주의**: 진입 애니메이션의 `transform`이 남으면 내부 스크롤이 죽는다 (커밋 `192ce83`에서 한 번 고친 이슈). 애니메이션 종료 후 `transform`을 반드시 제거하고, 회귀 테스트를 E2E에 남긴다.

### 6.6 신뢰도 필드 (`<ConfidenceField>`) — 서류 검수 전용

| 신뢰도 | 표시 |
|---|---|
| ≥ 0.9 | 일반 입력 (검은 텍스트) |
| 0.8 – 0.9 | `--warning-tint` 배경 + ⚠️ 아이콘 + "확인해 주세요" |
| < 0.8 | **빈 입력** + 플레이스홀더에 추출 후보 표시 + 원본 PDF 해당 위치로 스크롤하는 "원본 보기" 버튼 |

### 6.7 공통 상태 컴포넌트

모든 데이터 화면은 아래 4상태를 **반드시** 구현한다. 하나라도 빠지면 코드 리뷰에서 반려한다.

| 상태 | 처리 |
|---|---|
| 로딩 | 스켈레톤 (스피너 금지 — 레이아웃 점프 유발) |
| 비어 있음 | 일러스트 + 한 줄 설명 + 주요 액션 버튼 |
| 오류 | 원인 요약 + "다시 시도" + (필요 시) 고객센터 링크 |
| **오프라인** | 상단 배너 "오프라인 — 마지막 동기화 N분 전". 읽기는 허용, 쓰기는 큐에 적재 |

---

## 7. 모션

| 상황 | 지속 | 이징 |
|---|---|---|
| 탭 전환 | 180ms | `cubic-bezier(.2,.8,.2,1)` |
| 바텀시트 드래그 | 실시간 | 스프링 (stiffness 300, damping 30) |
| 카드 진입 | 220ms | `ease-out`, 최대 3개까지만 stagger 40ms |
| 지도 카메라 | 400ms | Google Maps `panTo`/`fitBounds` 기본 |

**`prefers-reduced-motion: reduce`일 때는 모든 위치 이동 애니메이션을 제거하고 투명도 전환만 남긴다.** (접근성 필수)

---

## 8. 접근성 체크리스트

- [ ] 모든 인터랙티브 요소 터치 타깃 ≥ 44×44pt
- [ ] 텍스트 대비 AA (본문 4.5:1, 큰 글씨 3:1) — 새 토큰 추가 시 계산 후 주석
- [ ] 색만으로 정보를 전달하지 않음 (신뢰도 낮은 필드는 색 + 아이콘 + 문구)
- [ ] 모든 이미지·아이콘 버튼에 `aria-label`
- [ ] 폼 입력에 `<label>` 연결
- [ ] 포커스 링 제거 금지 (`:focus-visible` 스타일 제공)
- [ ] VoiceOver로 주요 플로우 완주 가능 (여행 생성 → 일정 추가 → 서류 업로드 → 확정)
- [ ] Dynamic Type 200%에서 레이아웃 유지
- [ ] `prefers-reduced-motion` 대응
- [ ] 지도는 스크린리더에 요약 텍스트 제공 ("4개 장소, 총 이동 거리 8.3km")
