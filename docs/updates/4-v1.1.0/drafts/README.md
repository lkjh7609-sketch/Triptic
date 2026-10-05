# 레거시 정리 초안 (2026-10-06, 미적용)

| 파일 | 내용 |
|---|---|
| `0094_client_admin_trip_viewer.patch` | 운영 '회원 여행 보기'에서 항공편·숙소 줄 제거. 적용: `git apply -p1 docs/updates/4-v1.1.0/drafts/0094_client_admin_trip_viewer.patch` |
| `0094_drop_legacy_tables.sql` | 테이블 5개·함수 1개 삭제 + `admin_get_trip` 수정. 적용 시 `supabase/migrations/`로 옮기고 운영에 적용 |
| (아래 명령) | 사용하지 않는 Edge Function 삭제 |

## 적용 순서
1. 패치 적용 → 검사·테스트 → 푸시(배포)
2. SQL을 `supabase/migrations/0094_drop_legacy_tables.sql`로 옮겨 운영 적용
3. Edge Function 삭제

## Edge Function `parse-booking` 삭제
`api/parseDocument.js`(Vercel)가 대신하고 있고 호출하는 곳이 없다.

    supabase functions delete parse-booking --project-ref <ref>
    git rm -r supabase/functions/parse-booking

- `supabase/functions/translate/index.ts`, `src/features/documents/parseBooking/*`, `0015_vouchers_bucket.sql`의 주석이 이름을 언급할 뿐 호출은 아니다. 삭제 전에 `grep -rn "parse-booking"`으로 한 번 더 확인한다.
- `parse-booking`이 쓰던 환경 변수·시크릿이 Edge Function 쪽에 남아 있다면 함께 정리한다.

## 남는 것
- 패치 후 `admin.members.tripView.flights|outbound|return` 번역 키가 쓰이지 않게 된다. i18n 검사가 안 쓰는 키를 막지 않으면 둬도 되고, 막으면 4개 언어에서 함께 지운다.
