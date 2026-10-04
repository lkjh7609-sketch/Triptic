import { getSupabaseClient } from '@/shared/api/supabaseClient';

/** 프로필 사진은 이 크기(px)의 정사각형으로 줄여서 올린다 — 화면에 가장 크게 보이는 곳(72px)의 약 3.5배 */
export const AVATAR_SIZE = 256;
const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export class AvatarError extends Error {
  constructor(readonly code: 'not_image' | 'too_large' | 'decode_failed' | 'upload_failed') {
    super(code);
    this.name = 'AvatarError';
  }
}

/** 가운데를 정사각형으로 잘라 AVATAR_SIZE로 줄인 뒤 webp(안 되는 브라우저는 jpeg)로 압축한다. 보통 20~40KB */
export async function shrinkAvatar(file: File): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  if (!file.type.startsWith('image/')) throw new AvatarError('not_image');
  if (file.size > MAX_INPUT_BYTES) throw new AvatarError('too_large');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC처럼 이 브라우저가 못 읽는 형식
    throw new AvatarError('decode_failed');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AvatarError('decode_failed');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  const toBlob = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  const webp = await toBlob('image/webp', 0.85);
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };
  const jpeg = await toBlob('image/jpeg', 0.85);
  if (!jpeg) throw new AvatarError('decode_failed');
  return { blob: jpeg, ext: 'jpg' };
}

/** 줄인 사진을 본인 폴더에 올리고 공개 주소(캐시를 피하려고 버전 값을 붙임)를 돌려준다. 다른 확장자의 예전 파일은 지운다 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const { blob, ext } = await shrinkAvatar(file);
  const supabase = getSupabaseClient();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '3600' });
  if (error) throw new AvatarError('upload_failed');
  void supabase.storage.from('avatars').remove([`${userId}/avatar.${ext === 'webp' ? 'jpg' : 'webp'}`]);
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function removeAvatarFiles(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.storage.from('avatars').remove([`${userId}/avatar.webp`, `${userId}/avatar.jpg`]);
}

/** 우리가 올린 사진인가(소셜 로그인이 준 주소와 구분) */
export function isUploadedAvatar(url: string | null | undefined): boolean {
  return !!url && url.includes('/storage/v1/object/public/avatars/');
}
