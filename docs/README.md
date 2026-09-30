# Triptic 문서

처음이라면 **[HISTORY.md](HISTORY.md)** 부터 읽으세요. 지금 상태, 지켜야 할 원칙, 날짜별로 무엇이 바뀌었는지가 한곳에 있습니다.

## 지금 기준 문서

| 문서 | 내용 |
|---|---|
| **[HISTORY.md](HISTORY.md)** | 개발 기록(유일한 진행 기록). 현재 상태 · 지켜야 할 원칙 · 날짜별 변경 |
| [reports/](reports/) | 분석 보고서. 날짜-주제 이름으로 쌓습니다 |
| └ [2026-09-30 구독·성장·보안 보고서](reports/2026-09-30-subscription-growth-security.md) | 프리미엄 구독 설계, 기능 개선점, 보안 점검, 추천 기능, 실행 순서 |
| [../README.md](../README.md) | 서비스 소개, 로컬 개발, 스크립트, 프로젝트 구조 |
| [../supabase/migrations/README.md](../supabase/migrations/README.md) | DB 마이그레이션 적용 방식과 초기 전환 기록 |

## 설계 문서 (2026-09-20, 3.0 개편 계획)

개편을 시작할 때 쓴 계획과 명세입니다. 이후 실제 구현은 계획과 달라진 부분이 있으니, 다를 때는 코드와 [HISTORY.md](HISTORY.md)가 우선입니다.

| 문서 | 내용 |
|---|---|
| [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) | 현재 상태 진단, 아키텍처 결정(ADR), 기술 스택, 로드맵, 비용, 리스크, 과금 방향(§13) |
| [specs/01-design-system.md](specs/01-design-system.md) | 색 토큰, 타이포, 컴포넌트, 다크 모드, 접근성 |
| [specs/02-screens.md](specs/02-screens.md) | 홈/계획/커뮤니티/설정 화면 명세 |
| [specs/03-data-model.md](specs/03-data-model.md) | TypeScript 타입, Postgres 스키마, RLS, 마이그레이션 절차 |
| [specs/04-document-ai.md](specs/04-document-ai.md) | 예약 서류 자동 인식과 바우처 |
| [specs/05-weather.md](specs/05-weather.md) | 날씨 연동 |
| [specs/06-community.md](specs/06-community.md) | 커뮤니티와 콘텐츠 안전장치 |
| [specs/07-i18n.md](specs/07-i18n.md) | 다국어 |
| [specs/08-release-checklist.md](specs/08-release-checklist.md) | App Store 제출 체크리스트 |

## 보관 (갱신하지 않음)

| 문서 | 내용 |
|---|---|
| [archive/2026-09-21-rewrite-progress-log.md](archive/2026-09-21-rewrite-progress-log.md) | 3.0 개편 초기 진행 메모 원문. 정리본은 HISTORY.md |
| [archive/2026-09-18-app-overview-2x.md](archive/2026-09-18-app-overview-2x.md) | 2.x 시절 앱 소개 |
| [archive/2026-09-18-user-guide-2x.md](archive/2026-09-18-user-guide-2x.md) | 2.x 시절 사용자 가이드 |

## 문서 규칙

- 진행 기록은 **HISTORY.md 한 곳**에만 씁니다. 새 진행 메모 파일을 따로 만들지 않습니다.
- 분석·조사 결과는 `reports/YYYY-MM-DD-주제.md`로 추가하고 위 표에 한 줄 넣습니다.
- 더 이상 맞지 않는 문서는 지우지 말고 `archive/`로 옮긴 뒤 맨 위에 "보관용" 안내를 붙입니다.
- API 키·비밀번호·개인 연락처는 문서에 적지 않습니다.
