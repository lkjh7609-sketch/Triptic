import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const { uploadPostImage, showToast } = vi.hoisted(() => ({ uploadPostImage: vi.fn(), showToast: vi.fn() }));
vi.mock('./imageProcessing', () => ({ uploadPostImage, getPostImageUrl: (p: string) => `https://img.test/${p}` }));
vi.mock('@/shared/ui/toast', () => ({ showToast }));

import { PhotoSection } from './PhotoSection';
import { usePostPhotos, type PostPhoto } from './usePostPhotos';

const photo = (id: string): PostPhoto => ({ storagePath: id, width: 10, height: 10, previewUrl: `blob:${id}`, revokable: false });

function view(over: Partial<React.ComponentProps<typeof PhotoSection>> = {}) {
  const props = { photos: [], progress: null, max: 10, desktop: false, onFiles: vi.fn(), onCancel: vi.fn(), onRemove: vi.fn(), onMove: vi.fn(), ...over };
  render(<PhotoSection {...props} />);
  return props;
}

describe('PhotoSection', () => {
  it('비어 있으면 큰 추가 영역(모바일/PC 문구가 다르다)', () => {
    view();
    expect(screen.getByText('사진 추가')).toBeInTheDocument();
    expect(screen.getByText(/첫 번째 사진이 커버가 돼요/)).toBeInTheDocument();
  });

  it('PC는 끌어다 놓는 영역', () => {
    view({ desktop: true });
    expect(screen.getByText('사진을 끌어다 놓거나 눌러서 올리세요')).toBeInTheDocument();
    expect(screen.getByText('내 PC에서 사진 찾기')).toBeInTheDocument();
    // 거짓 안내는 없다
    expect(screen.queryByText(/HEIC|남은/)).not.toBeInTheDocument();
  });

  it('파일을 끌어다 놓으면 onFiles로 넘긴다', () => {
    const props = view({ desktop: true });
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    fireEvent.drop(screen.getByRole('region', { name: '사진' }), { dataTransfer: { files: [file], types: ['Files'] } });
    expect(props.onFiles).toHaveBeenCalledWith([file]);
  });

  it('다 올린 뒤에는 썸네일 줄: 첫 사진이 대표, ×로 삭제, + 사진 타일', () => {
    const props = view({ photos: [photo('a'), photo('b')] });
    expect(screen.getByText('등록된 사진 2/10')).toBeInTheDocument();
    expect(screen.getAllByText('대표')).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: '사진 삭제' })[1]);
    expect(props.onRemove).toHaveBeenCalledWith('b');
    expect(screen.getByRole('button', { name: '+ 사진' })).toBeInTheDocument();
  });

  it('10장이면 추가 타일이 사라진다', () => {
    view({ photos: Array.from({ length: 10 }, (_, i) => photo(`p${i}`)) });
    expect(screen.queryByRole('button', { name: '+ 사진' })).not.toBeInTheDocument();
  });

  it('올리는 중에는 n/m·%·취소·대기 타일을 보여 준다', () => {
    const props = view({ photos: [photo('a')], progress: { total: 4, done: 1 } });
    expect(screen.getByText('사진 처리 중…')).toBeInTheDocument();
    expect(screen.getByText('(2/4)')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('대기 3/4')).toBeInTheDocument();
    expect(screen.getByText('대기 4/4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /업로드 취소/ }));
    expect(props.onCancel).toHaveBeenCalled();
  });
});

describe('usePostPhotos', () => {
  beforeEach(() => {
    uploadPostImage.mockReset();
    showToast.mockReset();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  const file = (n: string) => new File(['x'], n, { type: 'image/jpeg' });

  it('차례로 올리고 끝나면 토스트(처음이면 커버 안내 포함)', async () => {
    uploadPostImage.mockImplementation(async (f: File) => ({ storagePath: `u1/${f.name}`, width: 1, height: 1 }));
    const { result } = renderHook(() => usePostPhotos('u1'));
    await act(async () => {
      await result.current.upload([file('a.jpg'), file('b.jpg')]);
    });
    expect(result.current.photos.map((p) => p.storagePath)).toEqual(['u1/a.jpg', 'u1/b.jpg']);
    expect(result.current.progress).toBeNull();
    expect(showToast).toHaveBeenCalledWith('사진 2장이 추가되었어요', expect.objectContaining({ tone: 'success', description: '첫 번째 사진이 커버로 자동 지정되었어요', badge: '완료' }));
  });

  it('10장을 넘기면 올리지 않고 오류 토스트', async () => {
    const { result } = renderHook(() => usePostPhotos('u1'));
    await act(async () => {
      await result.current.upload(Array.from({ length: 11 }, (_, i) => file(`${i}.jpg`)));
    });
    expect(uploadPostImage).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('최대 10장'), { tone: 'error' });
  });

  it('올리다 실패하면 지금까지 올린 것은 남기고 오류 토스트', async () => {
    uploadPostImage.mockResolvedValueOnce({ storagePath: 'u1/a', width: 1, height: 1 }).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePostPhotos('u1'));
    await act(async () => {
      await result.current.upload([file('a'), file('b'), file('c')]);
    });
    expect(result.current.photos).toHaveLength(1);
    expect(result.current.progress).toBeNull();
    expect(showToast).toHaveBeenCalledWith(expect.any(String), { tone: 'error' });
  });

  it('취소하면 지금 올라가는 한 장까지만 마치고 멈춘다', async () => {
    let release: () => void = () => {};
    uploadPostImage.mockImplementationOnce(
      (f: File) => new Promise((resolve) => (release = () => resolve({ storagePath: `u1/${f.name}`, width: 1, height: 1 }))),
    );
    const { result } = renderHook(() => usePostPhotos('u1'));
    let done: Promise<unknown> = Promise.resolve();
    await act(async () => {
      done = result.current.upload([file('a'), file('b'), file('c')]);
    });
    act(() => result.current.cancel());
    await act(async () => {
      release();
      await done;
    });
    expect(result.current.photos.map((p) => p.storagePath)).toEqual(['u1/a']);
    expect(uploadPostImage).toHaveBeenCalledTimes(1);
  });

  it('순서 바꾸기·삭제', async () => {
    uploadPostImage.mockImplementation(async (f: File) => ({ storagePath: `u1/${f.name}`, width: 1, height: 1 }));
    const { result } = renderHook(() => usePostPhotos('u1'));
    await act(async () => {
      await result.current.upload([file('a'), file('b'), file('c')]);
    });
    act(() => result.current.move(2, 0));
    expect(result.current.photos.map((p) => p.storagePath)).toEqual(['u1/c', 'u1/a', 'u1/b']);
    act(() => result.current.remove('u1/a'));
    expect(result.current.photos.map((p) => p.storagePath)).toEqual(['u1/c', 'u1/b']);
  });
});
