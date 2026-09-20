/**
 * 서류 업로드 · 파싱 요청 · 바우처/예약 조회 서비스 계층
 * (04-document-ai.md §2 클라이언트 단계 1~5, §10.1)
 */
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import type { ParsedBooking } from './parseBooking/schema';

// §3.2 사전 검사
export const MAX_BYTES = 20 * 1024 * 1024;
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.apple.pkpass',
  'text/calendar',
] as const;

export function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return 'PDF, JPG, PNG, .pkpass, .ics 파일만 올릴 수 있어요.';
  }
  if (file.size > MAX_BYTES) {
    return '20MB를 넘는 파일은 올릴 수 없어요. 필요한 페이지만 잘라서 올려 주세요.';
  }
  return null;
}

export interface DocumentRow {
  id: string;
  trip_id: string;
  owner_id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  page_count: number | null;
  parse_status: 'pending' | 'processing' | 'parsed' | 'failed' | 'skipped';
  parse_error: string | null;
  created_at: string;
}

export interface BookingRow {
  id: string;
  trip_id: string;
  document_id: string | null;
  type: string;
  parsed: ParsedBooking;
  confirmed_by_user: boolean;
  parser_version: string | null;
  created_at: string;
}

export interface ParseBookingResponse {
  documentId: string;
  bookings: ParsedBooking[];
  parserUsed: string;
  warnings: string[];
  error?: string;
  code?: string;
}

/** §2 클라이언트 단계 4~5: Storage 업로드 → documents 행 생성 → parse-booking 호출 */
export async function uploadAndParseDocument(
  file: File,
  tripId: string,
  userId: string,
): Promise<ParseBookingResponse> {
  const supabase = getSupabaseClient();
  const ext = file.name.split('.').pop() || 'bin';
  // documents.id는 uuid 컬럼(0002 마이그레이션) — Storage 경로를 업로드 전에
  // 정해야 해서(§10.1 "vouchers/{user_id}/{trip_id}/{document_id}.{ext}") DB가
  // 기본값으로 채워줄 때까지 기다리지 않고 클라이언트에서 미리 만든다.
  const documentId = crypto.randomUUID();
  const storagePath = `${userId}/${tripId}/${documentId}.${ext}`;

  const { error: uploadErr } = await supabase.storage.from('vouchers').upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadErr) throw uploadErr;

  const { data: doc, error: insertErr } = await supabase
    .from('documents')
    .insert({
      id: documentId,
      trip_id: tripId,
      owner_id: userId,
      storage_path: storagePath,
      original_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select()
    .single();
  if (insertErr || !doc) throw insertErr ?? new Error('문서 등록에 실패했습니다.');

  const { data, error: fnErr } = await supabase.functions.invoke<ParseBookingResponse>('parse-booking', {
    body: { documentId: doc.id },
  });
  if (fnErr) throw fnErr;
  return data as ParseBookingResponse;
}

/** 검수 대기 중인(§9 확정 전) 예약 목록 */
export async function listPendingBookings(tripId: string): Promise<BookingRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('trip_id', tripId)
    .eq('confirmed_by_user', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as BookingRow[]) ?? [];
}

/** 검수 시트에서 사용자가 수정한 최종 값으로 교체 + 확정 표시 */
export async function confirmBooking(bookingId: string, edited: ParsedBooking): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('bookings')
    .update({ parsed: edited, confirmed_by_user: true })
    .eq('id', bookingId);
  if (error) throw error;
}

/** 검수 거절 — 일정에 반영하지 않고 예약 후보만 삭제 */
export async function rejectBooking(bookingId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('bookings').delete().eq('id', bookingId);
  if (error) throw error;
}

/** 바우처 원본 열람용 서명 URL(§10.1 "항상 5분 만료 서명 URL") — documents.id로 경로를 찾은 뒤 서명한다 */
export async function getVoucherSignedUrlByDocumentId(documentId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', documentId).single();
  if (!doc?.storage_path) return null;
  const { data, error } = await supabase.storage.from('vouchers').createSignedUrl(doc.storage_path, 300);
  if (error) return null;
  return data.signedUrl;
}
