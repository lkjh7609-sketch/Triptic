import { describe, expect, it } from 'vitest';
import { coverThumbUrl } from './coverThumb';

describe('coverThumbUrl', () => {
  it('우리 저장소 사진은 같은 버킷의 thumbs/ 로', () => {
    expect(coverThumbUrl('https://x.supabase.co/storage/v1/object/public/destination-covers/paris.webp')).toBe(
      'https://x.supabase.co/storage/v1/object/public/destination-covers/thumbs/paris.webp',
    );
  });

  it('이미 썸네일 주소면 그대로', () => {
    const url = 'https://x.supabase.co/storage/v1/object/public/destination-covers/thumbs/paris.webp';
    expect(coverThumbUrl(url)).toBe(url);
  });

  it('Unsplash는 너비만 160으로', () => {
    expect(coverThumbUrl('https://images.unsplash.com/photo-1?auto=format&fit=crop&w=800&q=80')).toBe(
      'https://images.unsplash.com/photo-1?auto=format&fit=crop&w=160&q=80',
    );
  });

  it('다른 주소는 건드리지 않는다', () => {
    expect(coverThumbUrl('https://example.com/a.jpg')).toBe('https://example.com/a.jpg');
  });
});
