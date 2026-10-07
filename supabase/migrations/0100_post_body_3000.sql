-- 0100: 글 본문 3000자 + 글 중간 사진
-- 본문 글자 수 한도를 2000 → 3000자로 늘린다. 글 중간 사진은 본문에 `![](저장경로)` 한 줄(약 80자)로 들어가고
-- 글자 수에서는 빠지므로(클라이언트·moderate-content), DB 한도는 사진 줄까지 합쳐 넉넉히 4000자로 둔다.
-- (사진은 post_images에도 들어 있어 글 삭제·보관 때 따로 챙길 것이 없다.)
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts add constraint posts_body_check check (char_length(body) between 1 and 4000);
