# ✈️ Triptic (트립틱)

> 복잡한 여행 일정을 가장 단순하고 세련되게.
> 지도 기반 일정 관리, AI 추천, 실시간 동행자 공유를 한 화면에서.

**🔗 서비스: [https://triptic.my](https://triptic.my)**

---

## 🌟 주요 기능

- 🧭 **직관적인 일정 관리**: 드래그 앤 드롭으로 순서 조정, 일차별 시간·메모 등록
- 🏙️ **일차별 활동 도시 지원**: 오사카 3일 + 교토 2일처럼 다구간 여행도 자유롭게
- 🗺️ **구글 지도 연동**: 장소 검색(Google Places), 대중교통 경로 시각화, 현재 위치 버튼
- ✨ **AI 주변 추천**: Gemini → Groq → OpenRouter 순으로 시도하고, 실패해도 큐레이션 데이터로 항상 결과 제공
- ✈️ **항공편 자동 조회**: 편명 입력만으로 출/도착 공항·시간 자동 완성
- 📄 **PDF 일정표 내보내기**: 인쇄용 A4 규격 고화질 PDF 생성
- 🔗 **실시간 공유 & 동행자 제안**: 로그인 없이 링크만으로 일정 열람, 동행자가 장소를 제안하면 작성자가 클릭 한 번으로 반영
- ☁️ **클라우드 자동 동기화**: Google/Kakao 로그인 시 모든 기기에서 실시간 동기화 (Supabase)
- 📱 **PWA & 오프라인 지원**: 설치 가능한 웹앱, 오프라인에서도 저장된 일정 열람

---

## 🏗️ 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Frontend | Vanilla JavaScript (`index.html`) + 점진적으로 모듈화 중인 `src/` (ES Modules) |
| 지도 | Google Maps JavaScript API, Places API |
| AI 추천 | Google Gemini API, Groq API, OpenRouter API (다중 폴백 + 자체 큐레이션 엔진) |
| 인증 & 데이터베이스 | [Supabase](https://supabase.com) (Auth + Postgres + Row Level Security) |
| 항공편 조회 | aviationstack API (서버 프록시 경유) |
| PDF | jsPDF |
| PWA | Service Worker, Web App Manifest |
| 빌드 도구 | Vite, TypeScript, Jest, ESLint |
| 배포 | Vercel (Serverless Functions) |
| 네이티브 앱 (준비 중) | Capacitor (iOS) |

> 데이터 저장 방식: 각 여행은 Supabase `trips` 테이블에 스냅샷(JSONB) 형태로 저장되며, 로그인한 사용자 본인만 Row Level Security로 접근할 수 있습니다. 공유 링크는 별도의 `shared_trips`/`suggestions` 테이블과 RLS 정책으로 "링크를 아는 사람만 읽기, 소유자만 쓰기"를 보장합니다.

---

## 🚀 로컬 개발

```bash
npm install
npm run dev
```

`http://localhost:3000` 에서 확인할 수 있습니다. `vite.config.js`의 개발 서버 미들웨어가 `/api/env`, `/api/flight`를 흉내내어 로컬에서도 API 라우트가 동작합니다.

### 환경 변수

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 채워주세요 (Vercel 프로젝트와 연결되어 있다면 `vercel env pull .env.local`로 한 번에 받아올 수 있습니다):

```bash
# 필수
SUPABASE_URL=              # Supabase 프로젝트 URL
SUPABASE_ANON_KEY=         # Supabase anon(public) key
GOOGLE_MAPS_API_KEY=       # 지도/장소 검색용

# 선택 (없으면 해당 기능만 자동으로 비활성화/폴백됨)
GEMINI_API_KEY=            # AI 추천 1순위 (하루 1,500회 무료)
GROQ_API_KEY=              # AI 추천 2순위 (하루 14,400회 무료)
OPENROUTER_API_KEY=        # AI 추천 3순위
AVIATIONSTACK_API_KEY=     # 항공편 자동 조회 (서버에만 두고 절대 클라이언트에 노출하지 않음)
```

> `AVIATIONSTACK_API_KEY`는 브라우저로 절대 전달되지 않습니다 (`/api/flight`가 서버에서만 사용). `SUPABASE_ANON_KEY`/`GOOGLE_MAPS_API_KEY`는 클라이언트에 노출되는 게 정상이며, 대신 Supabase는 Row Level Security로, Google Maps 키는 Google Cloud Console의 HTTP 리퍼러 제한으로 보호합니다.

### 데이터베이스 스키마

`supabase/schema.sql`을 Supabase 프로젝트의 SQL Editor에서 실행하면 필요한 테이블·RLS 정책·함수가 모두 생성됩니다. 재실행해도 안전하도록(`IF NOT EXISTS`/`DROP POLICY IF EXISTS`) 작성되어 있습니다.

### 주요 스크립트

```bash
npm run build          # www/·public/ 정적 자산 동기화 + 타입체크 + 프로덕션 빌드
npm test                # Jest 유닛 테스트
npm run typecheck       # TypeScript 타입 검사
npm run lint             # ESLint
```

---

## 📁 프로젝트 구조

```
triptic/
├── index.html                 # 메인 애플리케이션 (대부분의 UI 로직)
├── src/
│   ├── main.js                 # 모듈 진입점 — index.html에 <script type="module">로 연결됨
│   ├── services/                # Supabase 데이터 계층 (저장/공유/제안), API 서비스
│   ├── state/                   # 상태 관리
│   └── utils/                   # 날짜/시간/이스케이프 등 순수 유틸리티
├── api/
│   ├── env.js                  # 클라이언트에 노출 가능한 환경변수 주입
│   ├── recommend.js            # AI 주변 추천 (다중 프로바이더 + 폴백)
│   └── flight.js               # 항공편 조회 프록시 (키 서버 보관)
├── supabase/
│   └── schema.sql               # 테이블·RLS 정책·함수 정의
├── scripts/build.js             # www/·public/ 정적 자산 동기화
├── ios/                          # Capacitor iOS 프로젝트 (준비 중)
├── manifest.json / sw.js         # PWA 매니페스트 & 서비스 워커
└── vercel.json                   # 보안 헤더, CSP(Report-Only), 도메인 라우팅
```

---

## 🔐 보안

- 모든 데이터베이스 접근은 Supabase Row Level Security로 제어됩니다 (본인 소유 데이터만 조회/수정 가능).
- 공유 링크는 소유자만 생성·해제할 수 있고, 뷰어는 링크의 공유 코드를 아는 경우에만 읽기 전용으로 접근합니다.
- 서버 전용 API 키(`AVIATIONSTACK_API_KEY`, AI 프로바이더 키)는 클라이언트에 절대 전달되지 않고 Vercel 서버리스 함수 안에서만 사용됩니다.
- `/api/*` 엔드포인트는 Origin 화이트리스트, 레이트리밋, 입력값 검증을 적용합니다.
- `vercel.json`에 보안 헤더(X-Frame-Options, X-Content-Type-Options 등)와 CSP(Report-Only)를 적용해 두었습니다.

---

## 📄 라이선스

MIT License

---

## 👨‍💻 개발자

**Ben Lee** · [@lkjh7609-sketch](https://github.com/lkjh7609-sketch)
