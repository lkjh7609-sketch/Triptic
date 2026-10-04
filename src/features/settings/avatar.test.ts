import { describe, expect, it } from 'vitest';
import { AVATAR_SIZE, AvatarError, isUploadedAvatar, shrinkAvatar } from './avatar';

describe('avatar', () => {
  it('사진이 아닌 파일과 너무 큰 파일은 받지 않는다', async () => {
    await expect(shrinkAvatar(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toMatchObject({ code: 'not_image' });
    const big = new File([new Uint8Array(16 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    await expect(shrinkAvatar(big)).rejects.toBeInstanceOf(AvatarError);
    await expect(shrinkAvatar(big)).rejects.toMatchObject({ code: 'too_large' });
  });

  it('읽을 수 없는 이미지(이 환경엔 디코더가 없음)는 decode_failed', async () => {
    await expect(shrinkAvatar(new File(['x'], 'a.heic', { type: 'image/heic' }))).rejects.toMatchObject({ code: 'decode_failed' });
  });

  it('우리가 올린 사진인지 구분하고, 줄이는 크기는 256px', () => {
    expect(isUploadedAvatar('https://x.supabase.co/storage/v1/object/public/avatars/u1/avatar.webp?v=1')).toBe(true);
    expect(isUploadedAvatar('https://lh3.googleusercontent.com/a/photo')).toBe(false);
    expect(isUploadedAvatar(null)).toBe(false);
    expect(AVATAR_SIZE).toBe(256);
  });
});
