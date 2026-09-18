# ✈️ Triptic — 앱 소개

**Triptic**은 지도 기반으로 여행 일정을 짜고, AI 추천을 받고, 동행자와 실시간으로 공유할 수 있는 스마트 여행 플래너 웹앱입니다.

**서비스 주소**: [https://triptic.my](https://triptic.my)

## 한 줄 소개
> 복잡한 여행 일정을 지도 위에서 직관적으로 관리하고, 로그인 없이도 동행자와 실시간으로 공유·협업할 수 있는 여행 플래너.

## 핵심 기능
- 🧭 일차별 일정 관리 (드래그 순서 변경, 시간·메모)
- 🏙️ 다구간 여행 지원 (일차별로 다른 도시 설정)
- 🗺️ 구글 지도 연동 (장소 검색, 동선 시각화, 현재 위치)
- ✨ AI 주변 추천 (여러 AI 엔진 폴백 + 자체 큐레이션으로 항상 결과 제공)
- ✈️ 항공편 자동 조회
- 📄 PDF 일정표 출력
- 🔗 로그인 없는 실시간 공유 링크 + 동행자 장소 제안
- ☁️ Google/Kakao 로그인 시 클라우드 자동 동기화
- 📱 PWA (오프라인 열람, 설치 가능)

## 기술 스택

| 영역 | 기술 |
|---|---|
| Frontend | Vanilla JavaScript + 점진적 모듈화(ES Modules) |
| 지도 | Google Maps JavaScript API / Places API |
| AI 추천 | Google Gemini, Groq, OpenRouter (다중 폴백) |
| 인증·DB | Supabase (Auth + PostgreSQL + Row Level Security) |
| 항공편 조회 | aviationstack API |
| PDF 생성 | jsPDF |
| PWA | Service Worker + Web App Manifest |
| 빌드/검증 | Vite, TypeScript, Jest, ESLint |
| 배포 | Vercel (Serverless Functions + Edge) |
| 네이티브 앱 (준비 중) | Capacitor (iOS) |

## 아키텍처 한눈에 보기
- 모든 여행 데이터는 로그인한 사용자별로 Supabase에 저장되며, Row Level Security로 본인 데이터만 접근 가능합니다.
- 공유 링크는 별도 테이블(`shared_trips`, `suggestions`)과 정책으로 "링크를 아는 사람만 열람, 소유자만 관리" 구조를 보장합니다.
- 서버 전용 API 키(항공편 조회, AI 프로바이더)는 Vercel 서버리스 함수 뒤에 숨겨져 있어 브라우저에 노출되지 않습니다.

---
*더 자세한 사용법은 [USER_GUIDE.md](./USER_GUIDE.md), 개발/배포 관련 내용은 [README.md](./README.md)를 참고하세요.*
