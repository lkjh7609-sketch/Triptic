import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { arrayMove } from '@dnd-kit/sortable';
import { captureError } from '@/shared/monitoring';
import { showToast } from '@/shared/ui/toast';
import { getPostImageUrl, uploadPostImage, type UploadedPostImage } from './imageProcessing';

export const MAX_POST_IMAGES = 10;

/** 글에 붙일 사진 한 장 — storagePath가 곧 id(드래그 정렬·삭제의 키). 올린 파일은 미리보기용 object URL, 임시저장에서 복구한 것은 공개 URL */
export interface PostPhoto extends UploadedPostImage {
  previewUrl: string;
  /** object URL이라 치울 때 해제해야 하는지 */
  revokable: boolean;
}

/** 올리는 중인 상태 — total장 중 done장이 끝났고, 이어서 올라가는 한 장이 있다 */
export interface UploadProgress {
  total: number;
  done: number;
}

/** 임시저장에서 복구한 사진(이미 올라가 있는 것) */
export function photoFromStored(stored: UploadedPostImage): PostPhoto {
  return { ...stored, previewUrl: getPostImageUrl(stored.storagePath), revokable: false };
}

/**
 * 글쓰기 사진: 여러 장을 차례로 줄이고 올리면서 진행 상태(n/m)를 알려 주고, 취소·삭제·순서 바꾸기를 한다.
 * 취소하면 지금 올라가는 한 장까지만 마치고 멈춘다(이미 올라간 것은 남는다). 첫 사진이 대표(커버)다.
 * 끝나면 "사진 n장이 추가되었어요" 토스트(처음 올린 거면 커버 안내 포함)를 띄운다.
 */
export function usePostPhotos(userId: string, initial: PostPhoto[] = []) {
  const { t } = useTranslation('community');
  const [photos, setPhotos] = useState<PostPhoto[]>(initial);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const cancelRef = useRef(false);
  const photosRef = useRef<PostPhoto[]>(initial);
  // 올리는 동안·화면을 떠날 때 최신 목록을 읽기 위한 사본(렌더 중에는 건드리지 않는다)
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  // 화면을 떠날 때 미리보기 URL을 해제한다
  useEffect(
    () => () => {
      for (const p of photosRef.current) if (p.revokable) URL.revokeObjectURL(p.previewUrl);
    },
    [],
  );

  const upload = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith('image/') || f.type === '');
      if (images.length === 0) return;
      if (photosRef.current.length + images.length > MAX_POST_IMAGES) {
        showToast(t('compose.maxImagesError', { max: MAX_POST_IMAGES }), { tone: 'error' });
        return;
      }
      const firstUpload = photosRef.current.length === 0;
      cancelRef.current = false;
      setProgress({ total: images.length, done: 0 });
      let added = 0;
      try {
        for (const file of images) {
          if (cancelRef.current) break;
          const uploaded = await uploadPostImage(file, userId);
          setPhotos((prev) => [...prev, { ...uploaded, previewUrl: URL.createObjectURL(file), revokable: true }]);
          added += 1;
          setProgress({ total: images.length, done: added });
        }
      } catch (err) {
        captureError(err, { context: 'uploadPostImage' });
        showToast(t('compose.uploadImageError'), { tone: 'error' });
      } finally {
        setProgress(null);
      }
      if (added > 0) {
        showToast(t('compose.photosAdded', { count: added }), {
          description: firstUpload ? t('compose.photosCoverAuto') : undefined,
          badge: t('compose.done'),
          tone: 'success',
        });
      }
    },
    [t, userId],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const remove = useCallback((storagePath: string) => {
    setPhotos((prev) => {
      const target = prev.find((p) => p.storagePath === storagePath);
      if (target?.revokable) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.storagePath !== storagePath);
    });
  }, []);

  /** from번째 사진을 to번째로 옮긴다(맨 앞이 대표) */
  const move = useCallback((from: number, to: number) => {
    setPhotos((prev) => (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length ? prev : arrayMove(prev, from, to)));
  }, []);

  return { photos, setPhotos, progress, upload, cancel, remove, move, uploading: progress !== null };
}
