-- ============================================================================
-- 0092: 프로필 사진 저장소(사용자 요청 2026-10-05)
--  · 공개 읽기 버킷 'avatars' — 사진은 브라우저가 256px 정사각 webp로 줄여서 올린다(파일은 보통 수십 KB, 한도 512KB).
--  · 경로는 <사용자 id>/avatar.webp 하나(덮어쓰기). 본인 폴더에만 올리고·바꾸고·지울 수 있다. 회원 탈퇴 때 서버가 이 버킷도 비운다(api/_lib/deleteAccount.js).
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars owner insert" on storage.objects;
create policy "avatars owner insert" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner update" on storage.objects;
create policy "avatars owner update" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner delete" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
