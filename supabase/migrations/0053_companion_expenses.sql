-- ============================================================================
-- 0053: 동행 경비 나누기(N빵)
--
-- 매칭된(또는 끝난) 동행 모임에서 멤버가 쓴 돈을 기록하고, 앱이 통화별로
-- "누가 누구에게 얼마"를 계산한다(환율 변환 없음 — 통화마다 따로 정산).
-- 읽기는 멤버만(is_companion_member, 0032), 쓰기는 아래 RPC로만 — 결제자와 나눌
-- 사람이 모두 현재 멤버인지, 모임이 matched/closed인지 서버가 확인한다.
-- 나중에 그룹을 나간 사람이 지난 경비의 split_among에 남아 있어도 그대로 둔다
-- (지우면 이미 나눈 금액의 합이 맞지 않는다 — 앱이 "나감"으로 표시).
-- ============================================================================

create table public.companion_expenses (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.companion_posts(id) on delete cascade,
  payer_id    uuid not null references public.profiles(id) on delete cascade,
  amount      numeric(14, 2) not null check (amount > 0 and amount <= 100000000),
  currency    text not null check (currency ~ '^[A-Z]{3}$'),
  description text not null check (char_length(description) between 1 and 100),
  split_among uuid[] not null check (cardinality(split_among) between 1 and 20),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index companion_expenses_post_idx on public.companion_expenses (post_id, created_at);

alter table public.companion_expenses enable row level security;
create policy "read companion expenses as member" on public.companion_expenses for select
  using (public.is_companion_member(post_id));
revoke all on public.companion_expenses from anon, authenticated;
grant select on public.companion_expenses to authenticated;

create or replace function public.add_companion_expense(
  p_post_id uuid,
  p_payer_id uuid,
  p_amount numeric,
  p_currency text,
  p_description text,
  p_split_among uuid[]
)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_post record;
  v_members uuid[];
  v_split uuid[];
  v_id uuid;
begin
  if v_uid is null then raise exception 'login required' using errcode = '42501'; end if;
  select * into v_post from public.companion_posts where id = p_post_id;
  if v_post is null or v_post.status not in ('matched', 'closed') then raise exception 'this group is not active'; end if;

  v_members := array(
    select v_post.author_id
    union
    select a.applicant_id from public.companion_applications a where a.post_id = p_post_id and a.status = 'accepted'
  );
  if not (v_uid = any(v_members)) then raise exception 'only group members can add expenses' using errcode = '42501'; end if;
  if not (p_payer_id = any(v_members)) then raise exception 'payer must be a group member'; end if;

  v_split := array(select distinct unnest(p_split_among));
  if cardinality(v_split) = 0 or not (v_split <@ v_members) then
    raise exception 'split must include only group members';
  end if;

  insert into public.companion_expenses (post_id, payer_id, amount, currency, description, split_among, created_by)
  values (p_post_id, p_payer_id, round(p_amount, 2), upper(p_currency), btrim(p_description), v_split, v_uid)
  returning id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.delete_companion_expense(p_expense_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  delete from public.companion_expenses
    where id = p_expense_id and created_by = (select auth.uid());
  if not found then raise exception 'expense not found or not yours' using errcode = '42501'; end if;
end;
$fn$;

revoke all on function public.add_companion_expense(uuid, uuid, numeric, text, text, uuid[]) from public, anon, authenticated;
revoke all on function public.delete_companion_expense(uuid) from public, anon, authenticated;
grant execute on function public.add_companion_expense(uuid, uuid, numeric, text, text, uuid[]) to authenticated;
grant execute on function public.delete_companion_expense(uuid) to authenticated;
