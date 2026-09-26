# ✈️ Triptic (트립틱)

> 복잡한 여행 일정을 가장 단순하고 세련되게.
> 지도 기반 일정 관리, AI 추천, 커뮤니티, 동행찾기를 한 곳에서.

**🔗 서비스: [https://triptic.my](https://triptic.my)**

---

## 🌟 주요 기능

- 🧭 **직관적인 일정 관리**: 드래그 앤 드롭으로 순서 조정, 일차별 시간·메모·경비 등록
- 🏙️ **일차별 활동 도시 지원**: 오사카 3일 + 교토 2일처럼 다구간 여행도 자유롭게
- 🗺️ **구글 지도 연동**: 장소 검색(Google Places), 대중교통·자동차 경로 시각화, 현재 위치 버튼
- ✨ **AI 주변 추천**: Gemini → Groq → OpenRouter 순으로 시도하고, 실패해도 큐레이션 데이터로 항상 결과 제공
- ✈️ **항공편 자동 조회**: 편명 입력만으로 출/도착 공항·시간 자동 완성
- 📄 **PDF 일정표 내보내기**: 언어별(한/영/중/일) 글꼴을 자동 선택하는 인쇄용 A4 PDF
- 🔗 **실시간 공유 & 동행자 제안**: 로그인 없이 링크만으로 일정 열람, 동행자가 장소를 제안하면 작성자가 클릭 한 번으로 반영
- 💬 **커뮤니티**: 여행지별 게시판(글·댓글·사진), 팔로우·좋아요, 신고·차단, AI 콘텐츠 자동 검열
- 🧑‍🤝‍🧑 **동행찾기**: 동행 모집글 → 지원/수락 → 매칭 확정 시 그룹 채팅방 자동 개설, 실제로 만날 때 QR 코드로 같은 그룹인지 상호 확인
- ☁️ **클라우드 자동 동기화**: Google/Apple/Kakao 로그인 또는 이메일 가입 시 모든 기기에서 실시간 동기화 (Supabase)
- 🌐 **다국어 지원**: 한국어/영어/중국어(번체)/일본어 4개 언어, 로케일별 글꼴·날짜·복수형 처리
- 📱 **PWA & 오프라인 지원**: 설치 가능한 웹앱, 오프라인에서도 저장된 일정 열람, iOS 네이티브 앱(Capacitor)

---

## 🏗️ 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Frontend | React 19 + TypeScript, Vite, React Router v7 |
| 상태/데이터 | TanStack Query(서버 상태), Zustand(클라이언트 상태), react-hook-form + Zod |
| 지도 | Google Maps JavaScript API, Places API (`@googlemaps/js-api-loader`) |
| AI 추천 | Google Gemini API, Groq API, OpenRouter API (다중 폴백 + 자체 큐레이션 엔진) |
| 커뮤니티 모더레이션 | DeepSeek API 기반 텍스트/이미지 분류 + 자체 금칙어·스팸 휴리스틱, 3초 예산 내 fail-closed 판정 |
| 인증 & 데이터베이스 | [Supabase](https://supabase.com) (Auth, Postgres + Row Level Security, Storage, Realtime, Edge Functions) |
| 실시간 | Supabase Realtime(`postgres_changes`) — 동행찾기 그룹 채팅 |
| QR 상호 확인 | `qrcode.react`(생성), `qr-scanner`(카메라 스캔 + 이미지 업로드 폴백) |
| 드래그 앤 드롭 | `@dnd-kit` |
| 국제화 | i18next / react-i18next (ko·en·zh-TW·ja, 네임스페이스 분리 로딩) |
| PDF | jsPDF (언어별 글꼴 동적 로드) |
| 오류·분석 | Sentry, PostHog |
| PWA | Service Worker, Web App Manifest |
| 빌드/품질 도구 | Vite, TypeScript, Vitest + Testing Library, ESLint, Prettier |
| 배포(웹) | Vercel |
| 네이티브 앱 | Capacitor (iOS) |

> 데이터 저장 방식: 여행 일정은 정규화된 Supabase 테이블(`trips`, `trip_days`, `itinerary_items`, `flights`, `expenses` 등)에 저장되며, 모든 접근은 Row Level Security로 통제됩니다. 커뮤니티(`posts`/`comments`/`destinations`)와 동행찾기(`companion_posts`/`companion_applications`/`companion_messages`/`companion_qr_tokens`)도 같은 원칙을 따르되, 콘텐츠 생성처럼 서버 판단이 필요한 경로는 클라이언트가 직접 쓰지 못하도록 SECURITY DEFINER RPC/Edge Function을 통해서만 열려 있습니다.

---

## 🚀 로컬 개발

```bash
npm install
npm run dev
```

`http://localhost:3000`(기본 포트가 사용 중이면 자동으로 다음 포트)에서 확인할 수 있습니다.

### 환경 변수

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 채워주세요:

```bash
# 필수
VITE_SUPABASE_URL=              # Supabase 프로젝트 URL
VITE_SUPABASE_ANON_KEY=         # Supabase anon(public) key
VITE_GOOGLE_MAPS_API_KEY=       # 지도/장소 검색용

# Supabase Edge Function 시크릿 (supabase secrets set으로 등록, 클라이언트에 노출 안 됨)
DEEPSEEK_API_KEY=               # 커뮤니티/동행찾기 콘텐츠 자동 검열
GEMINI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY   # AI 주변 추천 다중 폴백
```

### 주요 스크립트

```bash
npm run dev             # 정적 자산 동기화 + 개발 서버
npm run build           # 정적 자산 동기화 + 타입체크 + 프로덕션 빌드
npm test                # Vitest 유닛 테스트
npm run typecheck       # TypeScript 타입 검사
npm run check:i18n      # 번역 키 누락/고아 키/보간 변수/하드코딩 한글 검사
npm run lint            # ESLint
npm run cap:sync        # 빌드 후 Capacitor iOS 프로젝트에 동기화
```

### 데이터베이스 스키마

`supabase/migrations/`의 각 파일을 순서대로 적용하면 테이블·RLS 정책·RPC·트리거가 구성됩니다. 로컬 개발 스택은 [Supabase CLI](https://supabase.com/docs/guides/local-development)로 띄울 수 있습니다.

---

## 📁 프로젝트 구조

```
Triptic/
├── src/
│   ├── app/                     # 라우터, 앱 셸(하단 탭), 데스크톱 헤더
│   ├── features/
│   │   ├── plan/                # 일정 관리, 지도, 항공편·경비, PDF 내보내기
│   │   ├── community/           # 게시판, 동행찾기, 채팅, 모더레이션, 운영 콘솔
│   │   ├── home/                # 홈 대시보드(모바일/데스크톱)
│   │   ├── documents/           # 예약 확인서 자동 인식(문서 AI)
│   │   ├── weather/              # 일정별 날씨
│   │   ├── settings/             # 프로필, 테마, 언어, 계정 관리
│   │   └── auth/                 # 로그인/가입
│   └── shared/
│       ├── api/                  # Supabase 클라이언트, 서비스 레이어
│       ├── i18n/                  # 다국어 초기화, 로케일별 폰트 로드
│       ├── ui/                    # 디자인 토큰, 공용 상태 컴포넌트
│       └── hooks/ a11y/ offline/ push/  # 공통 훅·접근성·오프라인·푸시
├── supabase/
│   ├── migrations/               # 순서대로 적용되는 SQL 마이그레이션
│   └── functions/                # Deno Edge Functions
│       ├── moderate-content/     # 게시글/댓글/동행찾기 콘텐츠 AI 모더레이션
│       ├── translate/             # 커뮤니티 글 번역
│       ├── fx-refresh/            # 환율 시간별 갱신(pg_cron)
│       ├── parse-booking/         # 예약 확인서 문서 AI 파싱
│       └── trip-itinerary-write/  # 일정 저장 RPC 경유 쓰기
├── docs/specs/                    # 화면·데이터모델·i18n·커뮤니티 등 설계 문서
├── ios/                            # Capacitor iOS 프로젝트
├── scripts/                        # 빌드 전처리, i18n 검사 스크립트
├── manifest.json / sw.js            # PWA 매니페스트 & 서비스 워커
└── vercel.json                      # 보안 헤더, 라우팅
```

---

## 🔐 보안

- 모든 데이터베이스 접근은 Supabase Row Level Security로 제어됩니다(본인 소유 데이터만 조회/수정 가능).
- 게시글·댓글·동행찾기 모집글/신청처럼 서버 판단(모더레이션 결과)이 필요한 쓰기는 클라이언트가 직접 할 수 없고, JWT를 검증한 Edge Function이 `service_role` 전용 RPC를 호출하는 경로로만 열려 있습니다.
- 수락/거절/매칭 확정/QR 발급·검증처럼 소유자 판별만 필요한 동작은 함수 내부에서 `auth.uid()`로 자체 인가하는 RPC로 처리합니다.
- QR 코드는 실명·연락처 등 개인정보를 담지 않는 무작위 토큰이며, 검증 시 같은 매칭 그룹 구성원 여부만 확인합니다.
- 공유 링크는 소유자만 생성·해제할 수 있고, 뷰어는 공유 코드를 아는 경우에만 읽기 전용으로 접근합니다.
- 서버 전용 API 키(AI 프로바이더, DeepSeek 등)는 클라이언트에 전달되지 않고 Supabase Edge Function 환경에서만 사용됩니다.
- `npm run check:i18n`이 CI 게이트로 걸려 있어 번역 누락뿐 아니라 `.ts`/`.tsx`에 남은 하드코딩 한글도 자동으로 잡아냅니다.

---

## 📄 라이선스

MIT License

---

## 👨‍💻 개발자

**Ben Lee** · [@lkjh7609-sketch](https://github.com/lkjh7609-sketch)
