-- ============================================================================
-- 0024: 푸시 알림 디바이스 토큰 저장 (Phase 6, 02-screens.md §5 "알림" 섹션)
-- 한 사용자가 여러 기기(교체·재설치 포함)에서 로그인할 수 있으므로
-- profiles에 컬럼 하나로 두지 않고 별도 테이블로 둔다. 실제 발송 로직은
-- 아직 없다(Apple Developer Program 미가입 — APNs 키가 없어 실제 전송은
-- 불가능하다, entitlements.can() 배선과 같은 패턴: 값은 저장되지만 소비자는
-- 아직 없음). 이 마이그레이션은 토큰을 "받아서 저장"할 수 있는 자리만
-- 마련해둔다.
-- ============================================================================

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- 본인 토큰만 등록/조회/삭제 가능. 발송은 service_role로만 하므로(RLS 우회)
-- 별도 admin 정책이 필요 없다.
create policy "read own push tokens" on public.push_tokens
  for select using (auth.uid() = user_id);

create policy "insert own push tokens" on public.push_tokens
  for insert with check (auth.uid() = user_id);

create policy "delete own push tokens" on public.push_tokens
  for delete using (auth.uid() = user_id);

create or replace function public.touch_push_token_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.touch_push_token_updated_at() from public;

drop trigger if exists push_tokens_touch_updated_at on public.push_tokens;
create trigger push_tokens_touch_updated_at
  before update on public.push_tokens
  for each row execute function public.touch_push_token_updated_at();
