-- ============================================================================
-- 0105: 통계 탭의 도트 캐릭터를 내가 바꿀 수 있게(설정 > 내 정보 변경 > 랜덤으로 바꾸기)
--
-- 도트 캐릭터는 이 값(없으면 사용자 ID)으로 만들어진다 — 같은 값이면 늘 같은 모습.
-- 본인 행만 고칠 수 있다(기존 profiles update 정책 그대로). 친구의 통계 화면에도 내가 고른 모습이 보이도록
-- 공개 프로필 뷰(community_profiles)에도 내보낸다(뷰 끝에 열만 덧붙임 — 기존 열·옵션은 그대로).
-- ============================================================================

alter table public.profiles add column if not exists pixel_avatar_seed text
  check (pixel_avatar_seed is null or char_length(pixel_avatar_seed) <= 40);

create or replace view public.community_profiles as
 SELECT id,
    display_name,
    avatar_url,
    bio,
    (role = 'admin'::text) AS is_admin,
    ( SELECT round(avg(r.rating), 1) AS round
           FROM companion_reviews r
          WHERE (r.reviewee_id = profiles.id)) AS rating_avg,
    ( SELECT (count(*))::integer AS count
           FROM companion_reviews r
          WHERE (r.reviewee_id = profiles.id)) AS rating_count,
    pixel_avatar_seed
   FROM profiles;
