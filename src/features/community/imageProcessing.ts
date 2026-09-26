/**
 * 게시 이미지 처리 (06-community.md §7)
 * 장변 1600px 리사이즈 + WebP 변환 + EXIF 전체 제거(GPS 포함).
 *
 * EXIF 제거는 별도 라이브러리 없이 캔버스 재인코딩만으로 해결한다 — 캔버스에
 * 그린 뒤 toBlob으로 뽑아낸 이미지는 원본 바이트가 아니라 픽셀을 새로
 * 인코딩한 결과라 EXIF(위치정보 포함)가 애초에 옮겨지지 않는다.
 * createImageBitmap이 EXIF orientation은 픽셀에 반영해 그려주므로(가로/세로
 * 뒤집힘 방지) 시각적 손실도 없다.
 */
import i18next from '@/shared/i18n';
import { getSupabaseClient } from '@/shared/api/supabaseClient';

const MAX_EDGE = 1600;
const WEBP_QUALITY = 0.85;

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function processImageForUpload(file: File, maxEdge = MAX_EDGE): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  if (Math.max(width, height) > maxEdge) {
    const scale = maxEdge / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error(i18next.t('community:errors.imageUnsupported'));
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error(i18next.t('community:errors.imageConvertFailed')))),
      'image/webp',
      WEBP_QUALITY,
    );
  });

  return { blob, width, height };
}

export interface UploadedPostImage {
  storagePath: string;
  width: number;
  height: number;
}

/** 처리 + 업로드까지 한 번에 — 경로 규칙은 {user_id}/{uuid}.webp (0020 RLS와 일치) */
export async function uploadPostImage(file: File, userId: string): Promise<UploadedPostImage> {
  const { blob, width, height } = await processImageForUpload(file);
  const path = `${userId}/${crypto.randomUUID()}.webp`;
  const supabase = getSupabaseClient();
  const { error } = await supabase.storage.from('post-images').upload(path, blob, {
    contentType: 'image/webp',
    upsert: false,
  });
  if (error) throw error;
  return { storagePath: path, width, height };
}

export function getPostImageUrl(storagePath: string): string {
  const supabase = getSupabaseClient();
  return supabase.storage.from('post-images').getPublicUrl(storagePath).data.publicUrl;
}
