-- ============================================================================
-- 0071: 문의하기를 "일반 문의"와 "제휴문의"로 나눈다.
--
-- user_feedback.category('general' | 'partnership') — 기본값은 일반 문의라 기존 글과 설정 화면의 문의하기는 그대로다.
-- 홈 푸터의 "제휴문의"는 같은 창을 제목만 "제휴문의"로 열고 category='partnership'으로 저장한다.
-- 관리자 목록 RPC(admin_list_feedback)는 구분해서 볼 수 있게 category 열과 필터(p_category, null이면 전체)를 더한다.
-- 반환 열이 늘어 함수를 다시 만든다(같은 이름의 예전 (int, int) 버전은 지운다).
-- ============================================================================

alter table public.user_feedback add column if not exists category text not null default 'general';
alter table public.user_feedback drop constraint if exists user_feedback_category_check;
alter table public.user_feedback add constraint user_feedback_category_check check (category in ('general', 'partnership'));

drop function if exists public.admin_list_feedback(int, int);

create or replace function public.admin_list_feedback(p_offset int default 0, p_limit int default 20, p_category text default null)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  handle text,
  body text,
  screenshot_path text,
  status text,
  created_at timestamptz,
  category text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select f.id, f.user_id, p.display_name, p.handle, f.body, f.screenshot_path, f.status, f.created_at, f.category
  from public.user_feedback f
  join public.profiles p on p.id = f.user_id
  where exists (select 1 from public.profiles admin_p where admin_p.id = auth.uid() and admin_p.role = 'admin')
    and (p_category is null or f.category = p_category)
  order by f.created_at desc
  limit p_limit offset p_offset;
$fn$;

revoke all on function public.admin_list_feedback(int, int, text) from public, anon;
grant execute on function public.admin_list_feedback(int, int, text) to authenticated;
