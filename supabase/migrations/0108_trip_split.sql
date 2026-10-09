-- ============================================================================
-- 0108: 여행 더치페이(함께 쓴 돈 정산) + '내 지출' 기준
--
-- 여행 경비(expenses)는 저장할 때마다 replace_trip_itinerary가 전부 지우고 다시 넣는다(0018) → 행 id가 매번 바뀌고,
-- 여러 명이 동시에 적으면 revision 충돌도 난다. 그래서 '같이 쓴 돈'은 경비와 따로 둔 장부로 만든다(동행 정산 0053 방식).
--
-- 1) trip_split_expenses  — 함께 쓴 돈(낸 사람·나눈 사람·금액). 읽기는 여행 멤버, 쓰기는 RPC만
-- 2) trip_split_transfers — 송금 완료 기록('받았어요/보냈어요')
-- 3) RPC 5개 — 멤버 확인은 can_access_trip(확정된 여행에서도 정산할 수 있어야 해서 can_edit_trip은 쓰지 않는다)
-- 4) replace_trip_itinerary — 경비의 paid_by(낸 사람)를 같이 저장. null이면 '여행 만든 사람의 지출'로 본다
-- 5) get_travel_stats — 통계 경비를 '내 지출'(내가 낸 개인 경비 + 내 더치페이 몫)로
-- 6) purge_user_data — 탈퇴한 사람의 개인 경비는 지운다(null로 두면 여행 만든 사람 지출로 바뀌어 버린다)
--
-- trips 행은 건드리지 않는다(revision이 오르면 다른 사람의 일정 저장이 충돌한다). 실시간 publication에도 넣지 않는다
-- (0059: 삭제 이벤트가 다른 구독자에게 새는 문제) — 화면이 다시 보일 때·주기적으로 다시 읽는다.
-- payer_id / split_among / from_user / to_user에는 profiles FK를 걸지 않는다 — 탈퇴해도 행이 지워져 남의 잔액이
-- 바뀌지 않게(화면에서 '나간 일행'으로 보인다).
-- ============================================================================

-- ── 멤버 확인 도우미: 여행 소유자 + trip_members(삭제된 여행·접근 권한 없는 사람에게는 빈 배열) ──
create or replace function public.trip_member_ids(p_trip_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select case when public.can_access_trip(p_trip_id) then
    array(
      select t.owner_id from public.trips t where t.id = p_trip_id and t.deleted_at is null
      union
      select m.user_id from public.trip_members m where m.trip_id = p_trip_id
    )
  else '{}'::uuid[] end;
$fn$;

revoke all on function public.trip_member_ids(uuid) from public, anon;
grant execute on function public.trip_member_ids(uuid) to authenticated;

-- ── 1) 함께 쓴 돈 ───────────────────────────────────────────────────────────
create table if not exists public.trip_split_expenses (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references public.trips(id) on delete cascade,
  -- 몇 일차(1부터). 일차가 정해지지 않은 건 null — 일정이 바뀌어도 이 번호는 그대로다
  day_index       int check (day_index is null or day_index between 1 and 400),
  category        text not null default 'other'
                  check (category in ('food', 'transport', 'lodging', 'shopping', 'activity', 'other')),
  description     text not null check (char_length(description) between 1 and 100),
  amount          numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  currency        text not null check (currency ~ '^[A-Z]{3}$'),
  -- 여행 기본 통화가 아닌 통화로 적었을 때, 적은 당시 환율(1 통화 = 몇 기본 통화)
  fx_rate_to_base numeric(18,8) check (fx_rate_to_base is null or fx_rate_to_base > 0),
  payer_id        uuid not null,
  split_among     uuid[] not null check (cardinality(split_among) between 1 and 20),
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists trip_split_expenses_trip_idx on public.trip_split_expenses (trip_id, created_at);

-- ── 2) 송금 완료 ────────────────────────────────────────────────────────────
create table if not exists public.trip_split_transfers (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references public.trips(id) on delete cascade,
  from_user  uuid not null,
  to_user    uuid not null,
  -- 여행 기본 통화 금액
  amount     numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index if not exists trip_split_transfers_trip_idx on public.trip_split_transfers (trip_id, created_at);

alter table public.trip_split_expenses enable row level security;
alter table public.trip_split_transfers enable row level security;

drop policy if exists "read trip split expenses as member" on public.trip_split_expenses;
create policy "read trip split expenses as member" on public.trip_split_expenses for select
  using (public.can_access_trip(trip_id));
drop policy if exists "read trip split transfers as member" on public.trip_split_transfers;
create policy "read trip split transfers as member" on public.trip_split_transfers for select
  using (public.can_access_trip(trip_id));

revoke all on public.trip_split_expenses from anon, authenticated;
revoke all on public.trip_split_transfers from anon, authenticated;
grant select on public.trip_split_expenses to authenticated;
grant select on public.trip_split_transfers to authenticated;

-- ── 3) RPC ──────────────────────────────────────────────────────────────────
-- 입력 검증은 add/update가 같다: 호출자는 멤버, 낸 사람·나눈 사람은 모두 현재 멤버
create or replace function public.add_trip_split_expense(
  p_trip_id uuid,
  p_day_index int,
  p_category text,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_fx_rate_to_base numeric,
  p_payer_id uuid,
  p_split_among uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_members uuid[];
  v_split uuid[];
  v_base text;
  v_cur text := upper(btrim(p_currency));
  v_id uuid;
begin
  if v_uid is null then raise exception 'login required' using errcode = '42501'; end if;
  v_members := public.trip_member_ids(p_trip_id);
  if not (v_uid = any(v_members)) then raise exception 'only trip members can add shared expenses' using errcode = '42501'; end if;
  if not (p_payer_id = any(v_members)) then raise exception 'payer must be a trip member'; end if;

  v_split := array(select distinct unnest(p_split_among));
  if cardinality(v_split) = 0 or not (v_split <@ v_members) then
    raise exception 'split must include only trip members';
  end if;

  select base_currency into v_base from public.trips where id = p_trip_id;

  insert into public.trip_split_expenses
    (trip_id, day_index, category, description, amount, currency, fx_rate_to_base, payer_id, split_among, created_by)
  values
    (p_trip_id, p_day_index, coalesce(p_category, 'other'), btrim(p_description), round(p_amount, 2), v_cur,
     case when v_cur = v_base then null else p_fx_rate_to_base end, p_payer_id, v_split, v_uid)
  returning id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.update_trip_split_expense(
  p_expense_id uuid,
  p_day_index int,
  p_category text,
  p_description text,
  p_amount numeric,
  p_currency text,
  p_fx_rate_to_base numeric,
  p_payer_id uuid,
  p_split_among uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_row public.trip_split_expenses;
  v_members uuid[];
  v_split uuid[];
  v_base text;
  v_cur text := upper(btrim(p_currency));
begin
  if v_uid is null then raise exception 'login required' using errcode = '42501'; end if;
  select * into v_row from public.trip_split_expenses where id = p_expense_id;
  if v_row.id is null or v_row.created_by is distinct from v_uid then
    raise exception 'expense not found or not yours' using errcode = '42501';
  end if;
  v_members := public.trip_member_ids(v_row.trip_id);
  if not (v_uid = any(v_members)) then raise exception 'only trip members can edit shared expenses' using errcode = '42501'; end if;
  if not (p_payer_id = any(v_members)) then raise exception 'payer must be a trip member'; end if;

  v_split := array(select distinct unnest(p_split_among));
  if cardinality(v_split) = 0 or not (v_split <@ v_members) then
    raise exception 'split must include only trip members';
  end if;

  select base_currency into v_base from public.trips where id = v_row.trip_id;

  update public.trip_split_expenses set
    day_index = p_day_index,
    category = coalesce(p_category, 'other'),
    description = btrim(p_description),
    amount = round(p_amount, 2),
    currency = v_cur,
    fx_rate_to_base = case when v_cur = v_base then null else p_fx_rate_to_base end,
    payer_id = p_payer_id,
    split_among = v_split,
    updated_at = now()
  where id = p_expense_id;
end;
$fn$;

create or replace function public.delete_trip_split_expense(p_expense_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  delete from public.trip_split_expenses
    where id = p_expense_id and created_by = (select auth.uid());
  if not found then raise exception 'expense not found or not yours' using errcode = '42501'; end if;
end;
$fn$;

-- 송금 완료: 보낸 사람이나 받은 사람만 적을 수 있고, 적은 사람만 취소할 수 있다
create or replace function public.add_trip_split_transfer(
  p_trip_id uuid,
  p_from uuid,
  p_to uuid,
  p_amount numeric,
  p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := (select auth.uid());
  v_members uuid[];
  v_id uuid;
begin
  if v_uid is null then raise exception 'login required' using errcode = '42501'; end if;
  v_members := public.trip_member_ids(p_trip_id);
  if not (v_uid = any(v_members)) then raise exception 'only trip members can record transfers' using errcode = '42501'; end if;
  if v_uid <> p_from and v_uid <> p_to then raise exception 'only the sender or the receiver can record a transfer' using errcode = '42501'; end if;

  insert into public.trip_split_transfers (trip_id, from_user, to_user, amount, currency, created_by)
  values (p_trip_id, p_from, p_to, round(p_amount, 2), upper(btrim(p_currency)), v_uid)
  returning id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.delete_trip_split_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  delete from public.trip_split_transfers
    where id = p_transfer_id and created_by = (select auth.uid());
  if not found then raise exception 'transfer not found or not yours' using errcode = '42501'; end if;
end;
$fn$;

revoke all on function public.add_trip_split_expense(uuid, int, text, text, numeric, text, numeric, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.update_trip_split_expense(uuid, int, text, text, numeric, text, numeric, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.delete_trip_split_expense(uuid) from public, anon, authenticated;
revoke all on function public.add_trip_split_transfer(uuid, uuid, uuid, numeric, text) from public, anon, authenticated;
revoke all on function public.delete_trip_split_transfer(uuid) from public, anon, authenticated;
grant execute on function public.add_trip_split_expense(uuid, int, text, text, numeric, text, numeric, uuid, uuid[]) to authenticated;
grant execute on function public.update_trip_split_expense(uuid, int, text, text, numeric, text, numeric, uuid, uuid[]) to authenticated;
grant execute on function public.delete_trip_split_expense(uuid) to authenticated;
grant execute on function public.add_trip_split_transfer(uuid, uuid, uuid, numeric, text) to authenticated;
grant execute on function public.delete_trip_split_transfer(uuid) to authenticated;

-- ── 4) 경비 저장에 낸 사람(paid_by) 싣기 ────────────────────────────────────
-- paid_by가 null이면 '여행 만든 사람의 지출'로 본다(옛 데이터·옛 앱의 저장이 같은 규칙으로 처리된다).
-- 멤버가 아닌 사람 id가 오면 null로 둔다.
create or replace function public.replace_trip_itinerary(
  p_trip_id uuid,
  p_days jsonb,
  p_items jsonb,
  p_legs jsonb,
  p_expenses jsonb
) returns void
language plpgsql
as $fn$
declare
  v_day jsonb;
  v_item jsonb;
  v_leg jsonb;
  v_exp jsonb;
  v_day_id uuid;
  v_item_id uuid;
  v_paid_by uuid;
  v_members uuid[];
  day_id_map jsonb := '{}'::jsonb;
  item_id_map jsonb := '{}'::jsonb;
begin
  if not public.can_edit_trip(p_trip_id) then
    raise exception 'access denied to trip %', p_trip_id;
  end if;

  v_members := public.trip_member_ids(p_trip_id);

  delete from public.expenses where trip_id = p_trip_id;
  -- trip_days 삭제가 itinerary_items(on delete cascade)를, 그게 다시
  -- legs(on delete cascade)를 연쇄 삭제한다 — 0003/0004 FK 정의 참고.
  delete from public.trip_days where trip_id = p_trip_id;

  for v_day in select * from jsonb_array_elements(p_days) loop
    insert into public.trip_days (trip_id, day_index, date, city_name, city_lat, city_lng, timezone)
    values (
      p_trip_id,
      (v_day->>'day_index')::int,
      (v_day->>'date')::date,
      v_day->>'city_name',
      (v_day->>'city_lat')::double precision,
      (v_day->>'city_lng')::double precision,
      v_day->>'timezone'
    )
    returning id into v_day_id;
    day_id_map := day_id_map || jsonb_build_object(v_day->>'day_index', v_day_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_day_id := (day_id_map->>(v_item->>'day_index'))::uuid;
    insert into public.itinerary_items (
      trip_id, day_id, position, type, title, subtitle, category, google_place_id,
      lat, lng, address, country_code, start_local, timezone, start_at, memo, extra, created_by
    )
    values (
      p_trip_id, v_day_id,
      (v_item->>'position')::int,
      v_item->>'type', v_item->>'title', v_item->>'subtitle', v_item->>'category',
      v_item->>'google_place_id',
      (v_item->>'lat')::double precision, (v_item->>'lng')::double precision,
      v_item->>'address', v_item->>'country_code',
      v_item->>'start_local', v_item->>'timezone',
      (v_item->>'start_at')::timestamptz, v_item->>'memo',
      v_item->'extra', auth.uid()
    )
    returning id into v_item_id;
    item_id_map := item_id_map || jsonb_build_object(
      (v_item->>'day_index') || ':' || (v_item->>'position'), v_item_id::text
    );
  end loop;

  for v_leg in select * from jsonb_array_elements(p_legs) loop
    insert into public.legs (trip_id, from_item_id, to_item_id, mode, distance_m, duration_s, is_estimate, provider)
    values (
      p_trip_id,
      (item_id_map->>((v_leg->>'day_index') || ':' || (v_leg->>'from_position')))::uuid,
      (item_id_map->>((v_leg->>'day_index') || ':' || (v_leg->>'to_position')))::uuid,
      coalesce(v_leg->>'mode', 'unknown'),
      (v_leg->>'distance_m')::int,
      (v_leg->>'duration_s')::int,
      coalesce((v_leg->>'is_estimate')::boolean, true),
      coalesce(v_leg->>'provider', 'haversine')
    )
    on conflict (from_item_id, to_item_id, mode) do nothing;
  end loop;

  for v_exp in select * from jsonb_array_elements(p_expenses) loop
    v_day_id := nullif(day_id_map->>(v_exp->>'day_index'), '')::uuid;
    v_paid_by := nullif(v_exp->>'paid_by', '')::uuid;
    if v_paid_by is not null and not (v_paid_by = any(v_members)) then v_paid_by := null; end if;
    insert into public.expenses (trip_id, day_id, category, description, amount, currency, fx_rate_to_base, payment_method, paid_by)
    values (
      p_trip_id, v_day_id,
      coalesce(v_exp->>'category', 'other'),
      v_exp->>'description',
      (v_exp->>'amount')::numeric,
      v_exp->>'currency',
      (v_exp->>'fx_rate_to_base')::numeric,
      v_exp->>'payment_method',
      v_paid_by
    );
  end loop;
end;
$fn$;

revoke all on function public.replace_trip_itinerary(uuid, jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.replace_trip_itinerary(uuid, jsonb, jsonb, jsonb, jsonb) to authenticated;

-- ── 5) 통계 경비 = 내 지출 ──────────────────────────────────────────────────
-- 내가 낸 개인 경비(paid_by가 null이면 여행 만든 사람 것) + 내가 나눈 더치페이의 내 몫(총액 ÷ 나눈 사람 수).
-- 기본 통화로 환산한 값(통화가 같으면 그대로, 다르면 입력 시점 환율 스냅샷, 없으면 null = 미환산).
create or replace function public.my_trip_expense_rows(p_trip_id uuid, p_base text, p_owner uuid)
returns table (category text, payment_method text, day_index int, amt numeric)
language sql
stable
as $fn$
  select e.category, e.payment_method, d.day_index,
         case when e.currency = p_base then e.amount when e.fx_rate_to_base is not null then e.amount * e.fx_rate_to_base end
  from public.expenses e
  left join public.trip_days d on d.id = e.day_id
  where e.trip_id = p_trip_id and coalesce(e.paid_by, p_owner) = auth.uid()
  union all
  select s.category, null::text, s.day_index,
         case when s.currency = p_base then s.amount when s.fx_rate_to_base is not null then s.amount * s.fx_rate_to_base end
           / cardinality(s.split_among)
  from public.trip_split_expenses s
  where s.trip_id = p_trip_id and auth.uid() = any(s.split_among)
$fn$;

revoke execute on function public.my_trip_expense_rows(uuid, text, uuid) from public, anon;
grant execute on function public.my_trip_expense_rows(uuid, text, uuid) to authenticated;

create or replace function public.get_travel_stats()
returns jsonb
language sql
stable
as $fn$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.start_date desc nulls last), '[]'::jsonb)
  from (
    select
      t.id as trip_id,
      t.title,
      t.city,
      t.city_lat,
      t.city_lng,
      t.start_date,
      t.end_date,
      t.total_days,
      t.base_currency,
      (select count(*) from public.trip_members m where m.trip_id = t.id)::int as member_count,
      -- 일차별로 다른 도시를 정해 둔 경우의 도시 좌표(여행 한 번에 여러 도시)
      coalesce((
        select jsonb_agg(jsonb_build_object('name', d.city_name, 'lat', d.city_lat, 'lng', d.city_lng) order by d.day_index)
        from public.trip_days d
        where d.trip_id = t.id and d.city_lat is not null and d.city_lng is not null
      ), '[]'::jsonb) as day_cities,
      -- 방문 장소(숙소·항공·메모 제외) 수와 분류별 수
      (select count(*) from public.itinerary_items i
        where i.trip_id = t.id and i.type not in ('lodging', 'flight', 'note'))::int as place_count,
      coalesce((
        select jsonb_object_agg(q.k, q.c)
        from (
          select coalesce(i.category, i.type) as k, count(*) as c
          from public.itinerary_items i
          where i.trip_id = t.id and i.type not in ('lodging', 'flight', 'note')
          group by 1
        ) q
      ), '{}'::jsonb) as place_categories,
      -- 경비(내 지출, 기본 통화 환산)
      ex.total as expense_total,
      coalesce(ex.unconverted, 0) as expense_unconverted,
      coalesce(ex.by_category, '{}'::jsonb) as expense_by_category,
      coalesce(ex.by_payment, '{}'::jsonb) as expense_by_payment,
      coalesce(ex.by_day, '{}'::jsonb) as expense_by_day,
      -- 항공 구간(항공사·출발/도착 공항 좌표) — 이동 거리·항공사 통계용
      coalesce((
        select jsonb_agg(i.extra -> 'flight' order by i.position)
        from public.itinerary_items i
        where i.trip_id = t.id and i.type = 'flight' and i.extra ? 'flight'
      ), '[]'::jsonb) as flights
    from public.trips t
    left join lateral (
      select
        sum(c.amt) as total,
        count(*) filter (where c.amt is null)::int as unconverted,
        (select jsonb_object_agg(g.k, g.s) from (
           select e2.category as k, sum(e2.amt) as s
           from public.my_trip_expense_rows(t.id, t.base_currency, t.owner_id) e2
           where e2.amt is not null group by 1) g) as by_category,
        (select jsonb_object_agg(g.k, g.s) from (
           select coalesce(e2.payment_method, 'unknown') as k, sum(e2.amt) as s
           from public.my_trip_expense_rows(t.id, t.base_currency, t.owner_id) e2
           where e2.amt is not null group by 1) g) as by_payment,
        (select jsonb_object_agg(g.k, g.s) from (
           select coalesce(e2.day_index, 0)::text as k, sum(e2.amt) as s
           from public.my_trip_expense_rows(t.id, t.base_currency, t.owner_id) e2
           where e2.amt is not null group by 1) g) as by_day
      from public.my_trip_expense_rows(t.id, t.base_currency, t.owner_id) c
    ) ex on true
    where t.deleted_at is null
      and (t.owner_id = auth.uid()
           or exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid()))
  ) x
$fn$;

revoke execute on function public.get_travel_stats() from public, anon;
grant execute on function public.get_travel_stats() to authenticated;

-- ── 6) 계정 삭제: 개인 경비는 지운다 ────────────────────────────────────────
-- 예전에는 paid_by를 null로 비웠는데, 이제 null은 '여행 만든 사람의 지출'이라 남은 일행의 경비가 만든 사람 것으로 바뀐다.
-- (더치페이 장부는 payer_id·split_among에 FK가 없어 행이 그대로 남고 화면에서 '나간 일행'으로 보인다.)
create or replace function public.purge_user_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'admin accounts cannot be purged' using errcode = '42501';
  end if;

  delete from public.expenses where paid_by = p_user_id;
  update public.itinerary_items set created_by = null where created_by = p_user_id;
  update public.reports set resolver_id = null where resolver_id = p_user_id;
  update public.moderation_events set actor_id = null where actor_id = p_user_id;

  update public.archived_content
     set children = jsonb_set(
           children, '{comments}',
           coalesce((select jsonb_agg(c) from jsonb_array_elements(children->'comments') c where c->>'author_id' <> p_user_id::text), '[]'::jsonb)
         )
   where source_table = 'posts' and children ? 'comments';

  delete from public.profiles where id = p_user_id;
end;
$fn$;
