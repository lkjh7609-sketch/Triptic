import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processImageForUpload } from './imageProcessing';

/** toBlob이 요청한 형식 중 지원하는 것만 만들고, 나머지는 PNG로 돌려주는(아이폰 사파리) 캔버스 흉내 */
function stubCanvas(supported: string[]) {
  const calls: string[] = [];
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
    toBlob: (cb: (b: Blob | null) => void, type: string) => {
      calls.push(type);
      cb(new Blob(['x'], { type: supported.includes(type) ? type : 'image/png' }));
    },
  };
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
  return { calls, canvas };
}

describe('processImageForUpload', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('WebP를 만들 수 있으면 WebP로, 긴 변을 1600px로 줄인다', async () => {
    const { canvas } = stubCanvas(['image/webp', 'image/jpeg']);
    const out = await processImageForUpload(new File(['a'], 'a.png'));
    expect(out.ext).toBe('webp');
    expect(out.blob.type).toBe('image/webp');
    expect([out.width, out.height]).toEqual([1600, 1200]);
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
  });

  it('WebP를 못 만드는 브라우저(PNG로 돌려줌)는 JPEG로 다시 만든다 — 3MB PNG를 올리지 않는다', async () => {
    const { calls } = stubCanvas(['image/jpeg']);
    const out = await processImageForUpload(new File(['a'], 'a.png'));
    expect(calls).toEqual(['image/webp', 'image/jpeg']);
    expect(out.ext).toBe('jpg');
    expect(out.blob.type).toBe('image/jpeg');
  });
});
