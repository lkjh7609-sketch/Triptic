-- INSERT ... RETURNING(공급자가 대부분 select()를 체이닝)가 SELECT RLS 정책이
-- 하나도 없으면 실패한다는 걸 시뮬레이션에서 발견 — 본인 글은 볼 수 있게 한다.
create policy "select own feedback" on public.user_feedback for select
  using (user_id = (select auth.uid()));
