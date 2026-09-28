-- ============================================================================
-- 0055: 이메일 가입 중복확인
--
-- 로그인 전(anon)에 "이 이메일로 이미 가입했는지" 미리 물어보는 용도. auth.users는
-- 클라이언트가 직접 못 읽으니 SECURITY DEFINER 함수로 boolean 하나만 돌려준다.
-- (Supabase signUp은 이미 가입된 이메일이어도 메일 인증이 켜져 있으면 오류 없이 성공처럼
--  보이므로, 가입 화면에서 미리 알려주려면 이 함수가 필요하다.)
-- GoTrue는 이메일을 소문자로 저장하므로 입력만 소문자로 맞춰 unique 인덱스를 탄다.
-- ⚠️ 누구나 이메일 가입 여부를 알아낼 수 있게 되는 트레이드오프가 있다 — 사용자 요구
--    ("이메일 중복확인 필수")에 따른 의도된 노출이며, 돌려주는 값은 boolean뿐이다.
-- ============================================================================

create or replace function public.is_email_available(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $fn$
  select not exists (
    select 1 from auth.users u
    where u.email = lower(btrim(p_email))
  );
$fn$;

revoke all on function public.is_email_available(text) from public;
grant execute on function public.is_email_available(text) to anon, authenticated;
