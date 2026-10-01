-- ============================================================================
-- 0073: 도시 대표 사진 저장소(destination-covers) — 공개 읽기, 쓰기는 서비스 키로만(정책을 만들지 않으면 일반 사용자는 못 올린다).
-- 파일은 `슬러그.webp`(1024x768), 주소는 destinations.cover_url에 0074가 채운다.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('destination-covers', 'destination-covers', true, 524288, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
