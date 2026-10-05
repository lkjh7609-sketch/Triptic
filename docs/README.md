# Triptic 문서

처음이라면 **[updates/00-overview.md](updates/00-overview.md)** 부터 읽으세요. 지금 상태와 지켜야 할 원칙이 있습니다.

## 단계별 문서 (docs/updates/)

| 단계 | 폴더 | 안에 있는 것 |
|---|---|---|
| 1 · 2.x 옛 앱 | [1-v2x-legacy/](updates/1-v2x-legacy/) | `changelog.md`, 앱 소개, 사용자 가이드 (보관) |
| 2 · 3.0 전면 개편 | [2-v3.0-rewrite/](updates/2-v3.0-rewrite/) | `changelog.md`, 개발 계획서, 명세 `specs/01~08`, 초기 진행 메모 원문 |
| 3 · v1.0 출시 준비 | [3-v1.0-launch-prep/](updates/3-v1.0-launch-prep/) | `changelog.md`, 구독·성장·보안 보고서, 도시 사진·카탈로그·가이드 초안 |
| 4 · v1.1.0 (현재) | [4-v1.1.0/](updates/4-v1.1.0/) | `changelog.md`, `release-notes.md`(공지 게시용) |

그 밖에: [../README.md](../README.md)(서비스 소개·개발 방법), [../supabase/migrations/README.md](../supabase/migrations/README.md)(DB 마이그레이션), `private/`(git 제외 — 아직 안 고친 보안 약점 상세, 이 폴더만 로컬에 있음).

## 문서 규칙

- 진행 기록은 **현재 단계 폴더의 `changelog.md`** 에만 씁니다. 새 진행 메모 파일을 따로 만들지 않습니다.
- 새 버전을 내면 `docs/updates/N-vX.Y.Z/` 폴더를 만들고, 이 표와 `00-overview.md` 표에 한 줄 넣습니다.
- 분석·조사 보고서는 해당 단계 폴더에 `report-주제.md`로 넣습니다.
- API 키·비밀번호·개인 연락처는 문서에 적지 않습니다.
- 아직 안 고친 보안 약점의 상세는 `docs/private/`(git 제외)에만 적습니다.
