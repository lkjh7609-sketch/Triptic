-- ============================================================================
-- 0072: 동행 구하기 시안 — "날짜 미정" 모집글과 나이대 칩 새 정의.
--
-- 1) companion_posts.start_date / end_date를 비울 수 있게 한다(날짜 미정 = 둘 다 null). 둘 중 하나만 비는 것은 막는다.
--    올린 뒤에는 날짜를 고칠 수 없다(작성자 컬럼 가드, 0032). 날짜가 없으면
--      · 여행 완료(0046 complete_companion_trip): "시작일이 오늘보다 뒤면 막기"가 null이라 막히지 않는다 → 매칭 뒤 언제든 완료 가능(사용자 결정)
--      · 종료일 지난 자동 완료(close_ended_companion_trips): end_date < 오늘이 null이라 자동으로는 닫히지 않는다 → 주최자가 직접 완료
-- 2) pref_ages(0070)의 허용 값을 시안 칩으로 바꾼다: 20대 초반·20대 후반·30대 초반·30대 후반·40대·50대 이상.
--    예전 값(10s~60s)은 제약에서 없앤다 — 0070이 어제 들어갔고 쓴 글이 없어 지울 값이 없다(적용 전 확인).
-- ============================================================================

alter table public.companion_posts alter column start_date drop not null;
alter table public.companion_posts alter column end_date drop not null;

alter table public.companion_posts drop constraint if exists companion_posts_dates_both_or_none;
alter table public.companion_posts add constraint companion_posts_dates_both_or_none
  check ((start_date is null) = (end_date is null));

-- 혹시 예전 값이 남아 있으면 제약을 바꾸기 전에 비운다(없으면 아무 일도 안 한다)
update public.companion_posts set pref_ages = '{}' where pref_ages <> '{}';

alter table public.companion_posts drop constraint if exists companion_posts_pref_ages_check;
alter table public.companion_posts add constraint companion_posts_pref_ages_check
  check (
    pref_ages <@ array['20s_early', '20s_late', '30s_early', '30s_late', '40s', '50s_plus']::text[]
    and cardinality(pref_ages) <= 6
  );
