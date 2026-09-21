# Supabase 마이그레이션 — 적용 상태

> ✅ **`0000`~`0019` 전부 Supabase MCP(project_ref `ifzykfemjzqquyzgpqax`)를
> 통해 운영 프로젝트에 실제 적용 완료 — ADR-002 M0~M7 전체 완료
> (2026-09-21).** `trips.snapshot`은 `0019`로 완전히 drop됐다.

## 왜 이 순서인가

[`docs/specs/03-data-model.md` §6](../../docs/specs/03-data-model.md)의 M0~M7
절차를 따른다. `trips.snapshot`(JSONB) → 정규화 테이블 전환은
[`DEVELOPMENT_PLAN.md`](../../docs/DEVELOPMENT_PLAN.md) 리스크 레지스터 R8
("데이터 마이그레이션 중 사용자 여행 유실")로 지정된 가장 위험한 작업이다.

적용 직전 실측(Supabase MCP, 읽기 전용 연결로 먼저 확인): `trips`,
`places`, `hotels`, `flights`, `expenses`, `shared_trips`, `suggestions`,
`backup_mappings` 전부 0행, `user_profiles`만 3행 — 사실상 출시 전 상태였다.
**단, `0000`의 rename은 데이터가 아니라 이미 배포된 legacy 앱의 동작 자체를
깨뜨릴 수 있다는 점이 적용 직전 검증에서 확인됐다** (`legacy/index.html`의
`user_profiles` upsert, `src/services/supabaseService.js`의 `trips.user_id/
name/currency` 접근). 그래서 `0000`은 아래 코드 패치와 **같은 배포**로
묶어 적용했다 (커밋 `bf261ed`):
- `src/services/supabaseService.js` (trips 컬럼명 갱신)
- `legacy/index.html`, `www/index.html`, `ios/App/App/public/index.html` (user_profiles → profiles)

## 파일 목록과 적용 상태

| 파일 | 내용 | 상태 |
|---|---|---|
| `0000_reconcile_legacy_schema.sql` | `user_profiles→profiles`, `trips` 컬럼 rename, `expenses` 충돌 회피, `handle_new_user()` 갱신, Firebase 잔재 정리 | ✅ 적용됨 |
| `0001_trip_members_days.sql` | trip_members, trip_days | ✅ 적용됨 |
| `0002_documents_bookings.sql` | documents, bookings | ✅ 적용됨 |
| `0003_itinerary_items.sql` | itinerary_items | ✅ 적용됨 |
| `0004_legs.sql` | legs | ✅ 적용됨 |
| `0005_expenses.sql` | 새 정규화 expenses | ✅ 적용됨 |
| `0006_weather_cache.sql` | weather_cache, climate_normals | ✅ 적용됨 |
| `0007_rls_policies.sql` | 헬퍼 함수 + 전 테이블 RLS + storage 정책 | ✅ 적용됨 (public 스키마와 storage 스키마를 별도 호출로 나눠 적용) |
| `0008_shared_trip_cutover.sql` | `get_shared_trip()` 정규화 테이블 버전으로 교체 | ✅ 적용됨(2026-09-21, M4 완료 후) — 이 README가 한동안 갱신 안 돼 "보류"로 잘못 남아있었음 |
| `0009_dashboard_stats_rpc.sql` | `get_user_travel_stats()` | ✅ 적용됨 |
| `0010_usage_events.sql` | usage_events + 한도 확인 함수 | ✅ 적용됨 |
| `0011_account_deletion_request.sql` | 계정 삭제 요청/취소 RPC (즉시 반영분만) | ✅ 적용됨 |
| `0012_security_hardening.sql` | get_advisors 실측 기반 보안 정리 (아래 참고) | ✅ 적용됨 |
| `0013_fix_get_shared_trip_columns.sql` | `get_shared_trip()`이 `0000`에서 rename된 옛 컬럼명(`t.name`/`t.currency`)을 여전히 참조해 공유 링크 조회 시 에러가 나던 프로덕션 버그 수정 | ✅ 적용됨 |
| `0014_dashboard_stats_snapshot_rpc.sql` | 홈 대시보드 임시 RPC(`get_user_travel_stats_snapshot`, ADR-002 M4 완료 전 임시 데이터 소스) | ✅ 적용 후 `0016`에서 drop됨 |
| `0015_vouchers_bucket.sql` | `vouchers` Storage 버킷 + RLS(select/insert/delete, 본인 폴더만) | ✅ 적용됨 |
| `0016_retire_snapshot_stats_rpc.sql` | ADR-002 RPC 컷오버 — `0014` 임시 함수 drop, `useHomeStats`가 `get_user_travel_stats()`(0009) 사용하도록 전환 | ✅ 적용됨 |
| `0017_notification_prefs.sql` | `profiles.notification_prefs` 컬럼 추가(설정 탭 알림 섹션 저장용, 발송 로직은 아직 없음) | ✅ 적용됨 |
| `0018_normalized_readwrite.sql` | ADR-002 M7 준비: `itinerary_items.extra`(무손실 보존용 jsonb) + `replace_trip_itinerary()`(원자적 전체 교체) + `get_trip_itinerary_raw()`(읽기). Plan 탭·레거시를 snapshot 대신 정규화 테이블로 컷오버하기 위한 것 | ✅ 적용됨, 인증 컨텍스트 시뮬레이션으로 두 함수 모두 실제 실행 검증 완료 |
| `0019_drop_trips_snapshot.sql` | ADR-002 **M7**: `trips.snapshot` 컬럼 drop(불가역) | ✅ 적용됨 — Plan 탭(3.0)·레거시 컷오버(아래 M5~M7 참고) + 프로덕션 사후 검증 완료 |

### `0012`을 추가한 이유 (계획에 없던 후속 조치)

`0007` 적용 직후 `get_advisors(type=security)`로 재점검한 결과 두 가지를
발견해 즉시 고쳤다:
1. **`can_access_trip`/`can_edit_trip`은 절대 REVOKE하면 안 된다.** 어드바이저는
   "anon/authenticated가 호출 가능"을 경고로 표시하지만, 이 두 함수는 0007의
   모든 RLS 정책이 USING/WITH CHECK 절 안에서 authenticated·anon 권한으로 직접
   호출한다. REVOKE하면 관련 테이블 전체 조회/수정이 즉시 깨진다. 어드바이저
   권고를 따르지 않는 것이 맞는 판단이라 그대로 뒀다.
2. **PostgreSQL은 함수 생성 시 기본적으로 `PUBLIC`에 EXECUTE를 부여한다.**
   `usage_in_window`/`handle_new_user`(둘 다 서버·트리거 전용이어야 함)에서
   `anon`/`authenticated`만 REVOKE했더니 `PUBLIC` 경로로 여전히 호출 가능했다
   — `information_schema.routine_privileges`로 실측 후 발견, `REVOKE ALL ...
   FROM PUBLIC` + `GRANT ... TO service_role`로 수정.
3. 직접 설계한 `trip_members` 정책 중복(SELECT 이중 평가)과 `auth.uid()` →
   `(select auth.uid())` 최적화(`auth_rls_initplan` 권고)도 함께 반영.

### `0008`은 왜 한동안 보류였나 (해소됨)

`0008`은 지금 운영 중인 공유 링크 조회 함수를 정규화 테이블 기반으로
**완전히 교체**한다. 정규화 테이블(`itinerary_items`/`trip_days`/`legs`)에
실제 여행 데이터가 채워지기 전에 이걸 적용하면, 이미 배포되어 있는 모든
공유 링크가 즉시 빈 일정을 반환하기 때문에 M4(전체 배치 이관) 완료 전까지
보류했었다. M4가 끝난 뒤 적용 완료.

## 적용 절차 (M0~M7) — 전부 완료 (2026-09-21)

| 단계 | 내용 | 상태 |
|---|---|---|
| M0 | 전체 DB 백업 | ⚠️ 별도 백업 스냅샷은 생성하지 않음 — 적용 직전 실측 결과 trips 등 전 테이블 0행(M1 시점), M7 시점엔 실사용자 0명(사용자 확인)이라 손실 위험 데이터 자체가 없었음 |
| M1 | `0000`~`0007`, `0009`~`0012` 적용(신규 테이블+RLS) | ✅ 완료 |
| M2 | 변환 함수(`sync-trip-normalized`→`trip-itinerary-write` Edge Function) 배포 | ✅ 완료 |
| M3 | 검증: 행 수·날짜·좌표 체크섬 비교 ([03-data-model.md §6.3](../../docs/specs/03-data-model.md)) | ✅ 완료 |
| M4 | 전체 사용자 배치 실행 | ✅ 완료(운영 DB에 트립 1개뿐이라 그 트립에 직접 invoke) |
| M5 | 앱 배포 — dual-write 시작 | ✅ 완료 |
| M6 | 2주 관찰 후 dual-write 해제 | ✅ **생략** — 사용자 확인(실사용자 0명, 데이터 유실 무관)에 따라 2주 대기 대신 Plan 탭(3.0)+레거시 정규화 컷오버(아래) 후 즉시 전수 재검증으로 대체 |
| M7 | `snapshot` 컬럼 drop (불가역) | ✅ 완료(`0019`) — Plan 탭/레거시 둘 다 정규화 테이블을 1차 데이터로 읽고 쓰도록 먼저 전환한 뒤 실행. 사전에 `grep -rn "\.snapshot\b"`로 코드상 참조 0건 확인 |

**M6/M7 관련 중요 사실**: `trips.snapshot`은 Plan 탭(3.0, `src/shared/api/
tripService.ts`)뿐 아니라 **레거시 앱(`triptic.my` 루트, `src/services/
supabaseService.js`)도 직접 읽고 썼다.** M7을 안전하게 하려면 레거시까지
정규화 테이블 기반으로 전환해야 했다(레거시는 그대로 두고 3.0만 전환하는
것으로는 M7이 불가능 — 컬럼이 없으면 레거시가 즉시 깨짐). 두 서비스 계층
모두 `trip-itinerary-write`(쓰기)/`get_trip_itinerary_raw()`+
`itineraryTransform.ts`(읽기, 정규화 테이블→예전 snapshot과 동일한 JSON
모양으로 재구성)로 컷오버해 이 문제를 해결했다.

## 로컬 재현 방법 (향후 스테이징/로컬 개발 환경 구축 시)

```bash
supabase start          # 로컬 Postgres 기동
supabase db reset       # migrations/ 전체를 순서대로 로컬에 적용 (0008 포함 — 로컬에서는 무해)
```

이 저장소를 처음 다루는 환경(로컬 Supabase CLI로 새 프로젝트를 만드는 경우)에는
`0000`이 대상으로 삼는 `user_profiles`/`backup_mappings`/`handle_new_user()` 등이
애초에 존재하지 않으므로 `alter table if exists`/`drop function if exists`가
전부 조용히 스킵되고 `0001`부터 실효 적용된다.

## 다음에 할 일

- ADR-002(M0~M7)는 이 시점 기준 전부 완료. `unindexed_foreign_keys`
  (성능, INFO 레벨)·레거시(2.x) RLS 정책의 `auth_rls_initplan` 최적화는
  스펙 범위 밖이라 이번 라운드에서 보류. 데이터가 늘어나면 재검토
- 알려진 의도적 제약(`src/features/plan/itineraryTransform.ts` 상단 주석
  참고): 식사 슬롯의 "건너뛰기" 상태, 일차별 도시가 "명시적 override"인지
  "여행 기본값 상속"인지의 구분은 정규화 이관 후 복원되지 않음(스펙
  §6.2도 요구하지 않음)
