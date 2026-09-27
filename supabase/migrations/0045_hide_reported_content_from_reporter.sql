-- ============================================================================
-- 0045: 신고한 콘텐츠를 신고자 본인 화면에서 숨긴다
--
-- 신고 완료 안내(report.doneDesc)는 "신고해 주신 콘텐츠는 이제 회원님
-- 화면에서 보이지 않아요"라고 약속하는데, 실제로 숨기는 곳이 아무 데도
-- 없었다 — 목록/상세 모두 계속 보였다. 차단(blocks)과 같은 방식으로 공개
-- 읽기 정책에 "내가 신고한 대상 제외" 조건을 붙인다. reports의
-- unique (reporter_id, target_type, target_id) 인덱스가 이 조회를 그대로
-- 받쳐 주고, reports의 "read own reports" 정책이 본인 행 조회를 허용한다.
-- 작성자 본인/관리자/동행 멤버용 정책은 OR로 따로 있으니 건드리지 않는다.
-- ============================================================================

alter policy "read published posts" on public.posts
  using (
    status = 'published'
    and deleted_at is null
    and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = posts.author_id)
    and not exists (select 1 from public.blocks b where b.blocker_id = posts.author_id and b.blocked_id = auth.uid())
    and not exists (
      select 1 from public.reports r
      where r.reporter_id = (select auth.uid()) and r.target_type = 'post' and r.target_id = posts.id
    )
  );

alter policy "read published comments" on public.comments
  using (
    status = 'published'
    and deleted_at is null
    and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = comments.author_id)
    and not exists (select 1 from public.blocks b where b.blocker_id = comments.author_id and b.blocked_id = auth.uid())
    and not exists (
      select 1 from public.reports r
      where r.reporter_id = (select auth.uid()) and r.target_type = 'comment' and r.target_id = comments.id
    )
  );

alter policy "read images of visible posts" on public.post_images
  using (
    exists (
      select 1 from public.posts p
      where p.id = post_images.post_id
        and (
          p.author_id = auth.uid()
          or exists (select 1 from public.profiles ap where ap.id = auth.uid() and ap.role = 'admin')
          or (
            p.status = 'published'
            and p.deleted_at is null
            and not exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.author_id)
            and not exists (select 1 from public.blocks b where b.blocker_id = p.author_id and b.blocked_id = auth.uid())
            and not exists (
              select 1 from public.reports r
              where r.reporter_id = (select auth.uid()) and r.target_type = 'post' and r.target_id = p.id
            )
          )
        )
    )
  );

alter policy "read recruiting companion posts" on public.companion_posts
  using (
    status = 'recruiting'
    and deleted_at is null
    and not exists (select 1 from public.blocks b where b.blocker_id = (select auth.uid()) and b.blocked_id = companion_posts.author_id)
    and not exists (select 1 from public.blocks b where b.blocker_id = companion_posts.author_id and b.blocked_id = (select auth.uid()))
    and not exists (
      select 1 from public.reports r
      where r.reporter_id = (select auth.uid()) and r.target_type = 'companion_post' and r.target_id = companion_posts.id
    )
  );

alter policy "read companion messages as member" on public.companion_messages
  using (
    is_companion_member(post_id)
    and status <> 'removed'
    and not exists (
      select 1 from public.reports r
      where r.reporter_id = (select auth.uid()) and r.target_type = 'companion_message' and r.target_id = companion_messages.id
    )
  );
