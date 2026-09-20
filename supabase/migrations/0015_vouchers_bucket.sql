-- ============================================================================
-- 0015: vouchers Storage 버킷 + RLS
-- 출처: docs/specs/04-document-ai.md §10.1 "비공개 버킷. 접근은 항상 5분 만료 서명 URL"
-- 경로 규칙: {user_id}/{trip_id}/{document_id}.{ext} (src/features/documents/documentService.ts)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vouchers', 'vouchers', false, 20971520,
  array['application/pdf','image/jpeg','image/png','application/vnd.apple.pkpass','text/calendar']
)
on conflict (id) do nothing;

-- 경로의 첫 세그먼트(user_id)가 본인일 때만 접근 허용. parse-booking Edge
-- Function도 userClient(호출자 JWT, RLS 적용)로 다운로드하므로 이 정책이 그대로 적용된다.
drop policy if exists "vouchers owner select" on storage.objects;
create policy "vouchers owner select" on storage.objects for select
  using (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "vouchers owner insert" on storage.objects;
create policy "vouchers owner insert" on storage.objects for insert
  with check (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "vouchers owner delete" on storage.objects;
create policy "vouchers owner delete" on storage.objects for delete
  using (bucket_id = 'vouchers' and (storage.foldername(name))[1] = auth.uid()::text);
