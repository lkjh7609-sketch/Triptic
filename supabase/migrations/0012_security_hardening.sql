-- ============================================================================
-- 0012: 보안 하드닝 (get_advisors 실측 결과 반영)
-- 출처: Supabase MCP get_advisors(type=security) 실행 결과, 0000~0011 적용 직후
--
-- ⚠️ get_advisors가 "REVOKE 권장"으로 표시한 항목 중 can_access_trip / can_edit_trip
-- 은 의도적으로 손대지 않는다. 이 두 함수는 0007의 모든 RLS 정책(itinerary_items,
-- trip_days, legs, bookings, expenses)이 USING/WITH CHECK 절 안에서 authenticated·
-- anon 권한으로 직접 호출한다. SECURITY DEFINER 함수라도 "호출 시작" 자체는
-- 호출자의 EXECUTE 권한으로 게이트되므로, 여기서 REVOKE하면 그 즉시 관련 테이블
-- 전체가 아무것도 조회/수정할 수 없게 된다 (RLS가 전부 깨짐). 이 함수가 외부에
-- boolean 결과(trip_id 접근 가능 여부)를 노출하는 것은 실질적 정보 노출이 아니므로
-- 어드바이저 권고를 따르지 않는 것이 맞는 판단이다.
--
-- 반면 아래 항목은 실제로 서버(Edge Function/service_role) 전용이어야 하고
-- RLS 평가 경로에도 쓰이지 않으므로 REVOKE해도 안전하다:
--   - usage_in_window: 남용 방어 한도 판정용. 클라이언트가 직접 호출하면 다른
--     사용자의 p_user_id를 넣어 사용 패턴을 엿볼 수 있다 (03-data-model.md §9.3
--     "클라이언트가 직접 쓰지 않는다" 원칙의 연장선 — 읽기도 서버만).
--   - handle_new_user: auth.users insert 트리거 전용. REVOKE해도 트리거 실행
--     자체는 영향 없다(트리거는 EXECUTE 권한 체크 경로를 타지 않는다).
-- ============================================================================

-- ⚠️ PostgreSQL은 함수 생성 시 기본적으로 PUBLIC(모든 role 포함)에 EXECUTE를
-- 부여한다. anon/authenticated에서만 REVOKE하면 PUBLIC 경로로 여전히 호출
-- 가능하므로 반드시 PUBLIC에서 REVOKE하고, 실제로 호출해야 하는 role
-- (service_role)에만 다시 GRANT한다. (실측 중 발견 — information_schema.
-- routine_privileges로 PUBLIC 잔존 grant 확인 후 수정)
revoke all on function public.usage_in_window(uuid, text, interval) from public;
revoke all on function public.handle_new_user() from public;
grant execute on function public.usage_in_window(uuid, text, interval) to service_role;
grant execute on function public.handle_new_user() to service_role;

-- trip_members: "owner manages members"(FOR ALL)가 SELECT까지 포함해
-- "read members of accessible trips"와 SELECT에 대해 이중 평가되고 있었다
-- (get_advisors: multiple_permissive_policies). INSERT/UPDATE/DELETE만 남긴다.
drop policy if exists "owner manages members" on public.trip_members;
create policy "owner manages members" on public.trip_members for insert
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));
create policy "owner manages members update" on public.trip_members for update
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));
create policy "owner manages members delete" on public.trip_members for delete
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = (select auth.uid())));

-- auth_rls_initplan 최적화: 정책 안에서 auth.uid()를 직접 호출하면 매 행마다
-- 재평가된다. (select auth.uid())로 감싸면 플래너가 한 번만 평가한다 (동작은 동일).
drop policy if exists "owner only" on public.documents;
create policy "owner only" on public.documents for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists "read own usage" on public.usage_events;
create policy "read own usage" on public.usage_events
  for select using (user_id = (select auth.uid()));
