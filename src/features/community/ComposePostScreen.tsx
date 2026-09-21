import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { useTrips } from '@/features/plan/hooks/useTrips';
import { useDestinations } from './hooks/useDestinations';
import { useCreatePost } from './hooks/usePosts';
import { uploadPostImage, type UploadedPostImage } from './imageProcessing';
import styles from './ComposePostScreen.module.css';

const MAX_BODY_LENGTH = 2000;
const MAX_IMAGES = 10;

interface PendingImage extends UploadedPostImage {
  previewUrl: string;
}

/**
 * 글쓰기 (02-screens.md §4.3, 06-community.md §5.1, §7)
 * 텍스트 2000자 + 이미지 최대 10장(업로드 전 리사이즈+EXIF 제거) + 여행지
 * 태그 필수 + 내 일정 첨부 선택. 제출은 moderate-content Edge Function을
 * 거친다 — 클라이언트가 직접 posts를 published로 insert할 수 없다(0023).
 */
export function ComposePostScreen() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: destinations } = useDestinations();
  const { data: trips } = useTrips();
  const createPost = useCreatePost();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [destinationId, setDestinationId] = useState('');
  const [body, setBody] = useState('');
  const [tripId, setTripId] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'error'; text: string } | null>(null);

  useEffect(() => {
    trackScreenView('community_compose');
  }, []);

  if (!user) {
    return (
      <div className={styles.wrap}>
        <p className={styles.hint}>로그인 후 글을 작성할 수 있어요.</p>
      </div>
    );
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      setStatusMessage({ type: 'error', text: `이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.` });
      return;
    }
    setUploading(true);
    setStatusMessage(null);
    try {
      for (const file of files) {
        const uploaded = await uploadPostImage(file, user!.id);
        setImages((prev) => [...prev, { ...uploaded, previewUrl: URL.createObjectURL(file) }]);
      }
    } catch (err) {
      captureError(err, { context: 'uploadPostImage' });
      setStatusMessage({ type: 'error', text: '이미지 업로드에 실패했어요.' });
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setStatusMessage(null);
    if (!destinationId) {
      setStatusMessage({ type: 'error', text: '여행지를 선택해 주세요.' });
      return;
    }
    if (!body.trim()) {
      setStatusMessage({ type: 'error', text: '내용을 입력해 주세요.' });
      return;
    }
    try {
      const result = await createPost.mutateAsync({
        destinationId,
        body: body.trim(),
        tripId: tripId || null,
        images: images.map(({ storagePath, width, height }) => ({ storagePath, width, height })),
        userId: user!.id,
      });
      if (result.status === 'removed') {
        setStatusMessage({
          type: 'error',
          text: '커뮤니티 가이드라인을 위반하는 내용이 포함돼 있어 게시가 차단됐어요.',
        });
        return;
      }
      if (result.status === 'pending_review') {
        navigate('/community');
        return;
      }
      navigate(`/community/post/${result.id}`);
    } catch (err) {
      captureError(err, { context: 'createPost' });
      setStatusMessage({ type: 'error', text: '게시에 실패했어요. 잠시 후 다시 시도해 주세요.' });
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <button type="button" className={styles.cancelBtn} onClick={() => navigate(-1)}>
          취소
        </button>
        <h1 className={styles.title}>글쓰기</h1>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={createPost.isPending || uploading}
          onClick={handleSubmit}
        >
          {createPost.isPending ? '게시 중…' : '게시'}
        </button>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>여행지 (필수)</label>
        <select className={styles.select} value={destinationId} onChange={(e) => setDestinationId(e.target.value)}>
          <option value="">여행지를 선택해 주세요</option>
          {(destinations ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <textarea
          className={styles.bodyInput}
          placeholder="여행 이야기를 들려주세요"
          value={body}
          maxLength={MAX_BODY_LENGTH}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className={styles.counter}>
          {body.length}/{MAX_BODY_LENGTH}
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>내 일정 첨부 (선택)</label>
        <select className={styles.select} value={tripId} onChange={(e) => setTripId(e.target.value)}>
          <option value="">첨부 안 함</option>
          {(trips ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>사진 (최대 {MAX_IMAGES}장)</label>
        <div className={styles.imageGrid}>
          {images.map((img, i) => (
            <div key={img.storagePath} className={styles.imageThumbWrap}>
              <img src={img.previewUrl} alt="" className={styles.imageThumb} />
              <button type="button" className={styles.removeImageBtn} onClick={() => handleRemoveImage(i)}>
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES ? (
            <button
              type="button"
              className={styles.addImageBtn}
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? '처리 중…' : '+ 사진'}
            </button>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.hiddenInput}
          onChange={handleFilesSelected}
        />
      </div>

      {statusMessage ? (
        <p className={statusMessage.type === 'error' ? styles.errorMessage : styles.infoMessage}>
          {statusMessage.text}
        </p>
      ) : null}
    </div>
  );
}
