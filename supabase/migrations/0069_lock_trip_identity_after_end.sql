-- ============================================================================
-- 0069: 여행 종료일이 지나면 목적지와 날짜를 못 바꾼다 (모든 요금제 공통).
--
-- 이유: 여행 생성 한도(trips_created_count)는 평생 누적이라, 지난 여행의 목적지·날짜를 바꿔 새 여행처럼 다시 쓰면
-- 한도를 우회할 수 있다(완료 후 재편집 제한이 막으려던 편법). 오타·항목 수정·메모 같은 일정 내용 편집은 그대로 허용한다.
-- 요금제별 한도(무료 5개, 나중에 유료 3개 단위 판매 등)와 무관하게 "지난 여행은 그 여행의 목적지·날짜가 고정"이라는 규칙이다.
--
-- 잠그는 것: trips.city · city_lat · city_lng · start_date · end_date · total_days (값이 실제로 바뀔 때만 막는다 —
--   앱은 저장할 때마다 이 컬럼들을 그대로 다시 보내므로 값이 같으면 통과).
-- 기준: 종료일 + 1일이 지난 뒤(서버는 UTC 날짜 기준, 지구 반대편 여행의 시차 여유). 종료일이 없으면 잠그지 않는다.
-- 로그인 사용자(authenticated) 직접 수정에만 적용 — guard_protected_columns와 같은 방식(서비스 역할·관리자 함수는 통과).
-- ============================================================================

create or replace function public.guard_trip_identity_after_end()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if old.end_date is not null and old.end_date < current_date - 1 then
    if new.city is distinct from old.city
       or new.city_lat is distinct from old.city_lat
       or new.city_lng is distinct from old.city_lng
       or new.start_date is distinct from old.start_date
       or new.end_date is distinct from old.end_date
       or new.total_days is distinct from old.total_days then
      raise exception 'trip destination and dates are locked after the trip has ended'
        using errcode = 'P0001', hint = 'trip_locked_after_end';
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists guard_trip_identity_after_end on public.trips;
create trigger guard_trip_identity_after_end
  before update on public.trips
  for each row execute function public.guard_trip_identity_after_end();
