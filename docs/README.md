# Triptic 문서

## 개발계획서 (3.0 전면 개편)

| 문서 | 내용 |
|---|---|
| **[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)** | **여기서 시작.** 현재 상태 진단, 아키텍처 결정(ADR), 기술 스택, 22주 로드맵, 비용, 리스크 |
| [specs/01-design-system.md](specs/01-design-system.md) | 색 토큰(대비 검증 완료), 타이포, 컴포넌트, 다크 모드, 접근성 |
| [specs/02-screens.md](specs/02-screens.md) | 홈/계획/커뮤니티/설정 전 화면 명세 |
| [specs/03-data-model.md](specs/03-data-model.md) | TypeScript 타입 + Postgres 스키마 + RLS + 마이그레이션 |
| [specs/04-document-ai.md](specs/04-document-ai.md) | 예약 PDF 자동 인식 파이프라인 + 바우처 |
| [specs/05-weather.md](specs/05-weather.md) | 날씨 연동 (공급자 선정·캐싱·평년값 폴백) |
| [specs/06-community.md](specs/06-community.md) | 커뮤니티 + UGC 안전장치 |
| [specs/07-i18n.md](specs/07-i18n.md) | 한국어/영어/중국어 다국어 |
| [specs/08-release-checklist.md](specs/08-release-checklist.md) | App Store 제출 체크리스트 |

## 기존 문서

| 문서 | 내용 |
|---|---|
| [../README.md](../README.md) | 현재(2.x) 개발·배포 가이드 |
| [../APP_OVERVIEW.md](../APP_OVERVIEW.md) | 현재 앱 소개 |
| [../USER_GUIDE.md](../USER_GUIDE.md) | 사용자 가이드 |

## 읽는 순서

**처음 합류한 개발자**
1. `DEVELOPMENT_PLAN.md` §1 (현재 상태) → §4 (아키텍처 결정) → §9 (로드맵)
2. 맡은 영역의 스펙 1개
3. `specs/03-data-model.md` (모든 영역이 여기에 의존한다)

**디자이너**
`specs/01-design-system.md` → `specs/02-screens.md`

**기획·PM**
`DEVELOPMENT_PLAN.md` §2·§3·§8·§9·§11 → `specs/08-release-checklist.md`
