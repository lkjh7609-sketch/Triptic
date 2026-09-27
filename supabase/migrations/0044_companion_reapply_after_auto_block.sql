-- ============================================================================
-- 0044: 자동 검열로 막힌 동행 지원은 문구를 고쳐 다시 지원할 수 있게 한다
--
-- companion_applications는 (post_id, applicant_id) unique라서, 지원 메시지가
-- 분류기에 걸려 status='removed'로 한 번 저장되면 이후 모든 재지원이
-- unique_violation → "you already applied to this listing"으로 500이 났다.
-- 댓글/글은 막혀도 새로 쓰면 되는데 지원만 영구히 잠기는 셈이었다.
--
-- 기존 행이 removed이고 그 행의 마지막 모더레이션 이벤트가 auto_blocked
-- (= 분류기가 막은 뒤 한 번도 통과한 적 없음)일 때만 같은 행을 덮어쓴다.
-- 재지원이 통과하면 'reapplied' 이벤트를 남기므로, 그 뒤 관리자가 신고
-- 처리로 removed 시킨 지원(이벤트 없이 status만 바뀜)은 마지막 이벤트가
-- auto_blocked가 아니라서 계속 막힌다.
-- ============================================================================

create or replace function public.create_moderated_companion_application(
  p_applicant_id uuid,
  p_post_id uuid,
  p_message text,
  p_status text,
  p_score numeric,
  p_categories jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_id uuid;
  v_post record;
  v_existing record;
  v_last_action text;
begin
  if p_applicant_id is null then raise exception 'applicant required'; end if;
  if p_status not in ('pending', 'removed') then raise exception 'invalid status %', p_status; end if;

  select * into v_post from public.companion_posts where id = p_post_id;
  if v_post is null or v_post.status <> 'recruiting' then raise exception 'this listing is not accepting applicants'; end if;
  if v_post.author_id = p_applicant_id then raise exception 'organizer cannot apply to their own listing'; end if;
  if exists (select 1 from public.blocks b
             where (b.blocker_id = p_applicant_id and b.blocked_id = v_post.author_id)
                or (b.blocker_id = v_post.author_id and b.blocked_id = p_applicant_id)) then
    raise exception 'cannot apply to this listing';
  end if;

  select * into v_existing from public.companion_applications
    where post_id = p_post_id and applicant_id = p_applicant_id
    for update;

  if v_existing is not null then
    select e.action into v_last_action from public.moderation_events e
      where e.target_type = 'companion_application' and e.target_id = v_existing.id
      order by e.created_at desc
      limit 1;
    if v_existing.status <> 'removed' or v_last_action is distinct from 'auto_blocked' then
      raise exception 'you already applied to this listing';
    end if;

    update public.companion_applications
      set message = p_message, status = p_status, updated_at = now()
      where id = v_existing.id;
    v_id := v_existing.id;

    insert into public.moderation_events (target_type, target_id, action, source, score, categories)
    values ('companion_application', v_id,
            case when p_status = 'pending' then 'reapplied' else 'auto_blocked' end,
            'classifier', p_score, p_categories);
    return v_id;
  end if;

  insert into public.companion_applications (post_id, applicant_id, message, status)
  values (p_post_id, p_applicant_id, p_message, p_status)
  returning id into v_id;

  if p_status <> 'pending' then
    insert into public.moderation_events (target_type, target_id, action, source, score, categories)
    values ('companion_application', v_id, 'auto_blocked', 'classifier', p_score, p_categories);
  end if;
  return v_id;
exception
  when unique_violation then raise exception 'you already applied to this listing';
end;
$fn$;
