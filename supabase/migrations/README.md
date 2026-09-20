# Supabase 마이그레이션 — 적용 절차

> ⚠️ **이 디렉터리의 SQL은 이번 개편 라운드 기준으로 운영(triptic.my) 프로젝트에
> 아직 적용되지 않았다.** 로컬(`supabase start`)에서 문법·제약조건만 검증한
> 상태다. 실제 적용은 아래 절차와 사용자의 명시적 승인을 거친다.

## 왜 이 순서인가

[`docs/specs/03-data-model.md` §6](../../docs/specs/03-data-model.md)의 M0~M7
절차를 그대로 따른다. `trips.snapshot`(JSONB) → 정규화 테이블 전환은
[`DEVELOPMENT_PLAN.md`](../../docs/DEVELOPMENT_PLAN.md) 리스크 레지스터 R8
("데이터 마이그레이션 중 사용자 여행 유실")로 지정된, 이 프로젝트에서 가장
위험한 단일 작업이다.

## 파일 목록과 각 파일의 리스크 등급

| 파일 | 내용 | 기존 운영 데이터 영향 |
|---|---|---|
| `0000_reconcile_legacy_schema.sql` | `user_profiles→profiles`, `trips` 컬럼 rename, `expenses` 이름 충돌 회피 | **있음** — 기존 테이블을 rename/alter (컬럼 삭제 없음, 데이터 보존) |
| `0001_trip_members_days.sql` | trip_members, trip_days | 없음 (신규 테이블) |
| `0002_documents_bookings.sql` | documents, bookings | 없음 (신규 테이블) |
| `0003_itinerary_items.sql` | itinerary_items | 없음 (신규 테이블) |
| `0004_legs.sql` | legs | 없음 (신규 테이블) |
| `0005_expenses.sql` | 새 정규화 expenses | 없음 (0000이 기존 테이블을 먼저 비켜 둠) |
| `0006_weather_cache.sql` | weather_cache, climate_normals | 없음 (신규 테이블) |
| `0007_rls_policies.sql` | 헬퍼 함수 + 전 테이블 RLS | 없음 (신규 정책만 추가) |
| `0008_shared_trip_cutover.sql` | `get_shared_trip()` 정규화 테이블 버전으로 교체 | **있음 — 매우 중요** |
| `0009_dashboard_stats_rpc.sql` | `get_user_travel_stats()` | 없음 (신규 함수, 데이터 없으면 0 반환) |
| `0010_usage_events.sql` | usage_events + 한도 확인 함수 | 없음 (신규 테이블) |
| `0011_account_deletion_request.sql` | 계정 삭제 요청/취소 RPC (즉시 반영분만) | 없음 (신규 함수, `profiles.deletion_requested_at` 갱신만) |

`0000`과 `0008`을 제외한 모든 파일은 **기존 테이블을 읽거나 쓰지 않는
순수 추가(additive) 변경**이라 운영 서비스 동작에 영향을 주지 않는다.

### `0008`은 절대 다른 파일과 함께, 또는 일찍 적용하면 안 된다

`0008`은 지금 운영 중인 공유 링크 조회 함수를 정규화 테이블 기반으로
**완전히 교체**한다. 정규화 테이블에 실제 데이터가 채워지기 전에 이걸
적용하면, 이미 배포되어 있는 모든 공유 링크가 즉시 빈 일정을 반환한다.
반드시 아래 M4까지 끝낸 뒤에만 적용한다.

## 적용 절차 (실행 시 반드시 순서대로, 각 단계마다 확인)

| 단계 | 내용 | 이번 라운드 진행 여부 |
|---|---|---|
| M0 | 전체 DB 백업 + `trips` CSV 덤프를 별도 스토리지에 보관 | ❌ 미실행 (사용자 승인 필요) |
| M1 | `0000`~`0007`, `0009`~`0010` 적용 (신규 테이블 생성, 기존 테이블 미변경 원칙 유지하되 `0000`만 예외이므로 M0 이후에만) | ❌ 미실행 |
| M2 | 변환 함수 `migrate_trip_snapshot(trip_id)` 배포 + **내부 계정에서만** 실행 | ❌ 미작성 (Phase 1 후반 또는 Phase 2 착수 시 작성 예정) |
| M3 | 검증: 행 수·날짜·좌표 체크섬 비교 ([03-data-model.md §6.3](../../docs/specs/03-data-model.md)) | ❌ |
| M4 | 전체 사용자 배치 실행 (100건씩, 실패 시 중단) | ❌ |
| M5 | 앱 배포 — dual-write 시작 | ❌ |
| M6 | 2주 관찰 후 dual-write 해제 | ❌ |
| M7 | `snapshot` 컬럼 drop (불가역) | ❌ |

**M2(변환 함수)는 아직 작성하지 않았다.** 이번 라운드는 Phase 0(기반 정비) +
Phase 1 중 DB 비파괴 항목까지만 다루기로 했고, `snapshot` 변환 로직은 Phase 1
후반부에 스키마가 로컬에서 충분히 검증된 뒤 작성한다.

## 로컬 검증 방법

```bash
supabase start          # 로컬 Postgres 기동
supabase db reset       # migrations/ 전체를 순서대로 로컬에 적용
```

`0008`을 로컬 검증에 포함하려면, 로컬 DB에 샘플 데이터를 `0002~0005` 테이블에
직접 넣어 본 뒤 함수가 기대한 JSON을 반환하는지 확인한다 — 운영 데이터로는
검증하지 않는다.

## 운영 프로젝트 적용 전 체크리스트

- [ ] 사용자(레포 오너)의 명시적 승인
- [ ] M0 백업 완료 및 백업 파일 존재 확인
- [ ] 로컬에서 `supabase db reset`으로 0000~0010 전체가 오류 없이 적용됨
- [ ] `0000`의 rename 대상 테이블(`user_profiles`, `trips`, `expenses`)에 대해
      운영 프로젝트의 실제 컬럼 구성을 다시 한번 조회해 이 문서의 가정과
      일치하는지 확인 (스키마가 이 저장소 커밋 이후 바뀌었을 수 있음)
- [ ] `0008`은 M4 완료 후 별도 승인을 받아 마지막에 적용
