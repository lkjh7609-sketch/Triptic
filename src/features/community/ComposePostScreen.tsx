import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['community', 'common']);
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: destinations } = useDestinations();
  const { data: trips } = useTrips();
  const createPost = useCreatePost();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const initialDestSlug = searchParams.get('destination');

  const [destinationId, setDestinationId] = useState(() => {
    if (initialDestSlug && destinations) {
      const d = destinations.find(d => d.slug === initialDestSlug);
      if (d) return d.id;
    }
    return '';
  });

  useEffect(() => {
    if (initialDestSlug && destinations && !destinationId) {
      const d = destinations.find(d => d.slug === initialDestSlug);
      if (d) setDestinationId(d.id);
    }
  }, [destinations, initialDestSlug, destinationId]);
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
        <p className={styles.hint}>{t('compose.loginRequired')}</p>
      </div>
    );
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    if (images.length + files.length > MAX_IMAGES) {
      setStatusMessage({ type: 'error', text: t('compose.maxImagesError', { max: MAX_IMAGES }) });
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
      setStatusMessage({ type: 'error', text: t('compose.uploadImageError') });
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setStatusMessage(null);
    if (!body.trim()) {
      setStatusMessage({ type: 'error', text: t('compose.bodyRequiredError') });
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
          text: t('compose.moderationBlockedError'),
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
      setStatusMessage({ type: 'error', text: t('compose.submitError') });
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topBar}>
        <button type="button" className={styles.cancelBtn} onClick={() => navigate(-1)}>
          {t('action.cancel', { ns: 'common' })}
        </button>
        <h1 className={styles.title}>{t('compose.title')}</h1>
        <button
          type="button"
          className={styles.submitBtn}
          disabled={createPost.isPending || uploading}
          onClick={handleSubmit}
        >
          {createPost.isPending ? t('compose.submitting') : t('compose.submit')}
        </button>
      </div>
      <div className={styles.field}>
        <textarea
          className={styles.bodyInput}
          placeholder={t('compose.bodyPlaceholder')}
          value={body}
          maxLength={MAX_BODY_LENGTH}
          onChange={(e) => setBody(e.target.value)}
        />
        <span className={styles.counter}>
          {body.length}/{MAX_BODY_LENGTH}
        </span>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('compose.tripLabel')}</label>
        <select className={styles.select} value={tripId} onChange={(e) => setTripId(e.target.value)}>
          <option value="">{t('compose.tripNone')}</option>
          {(trips ?? []).map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.title}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label}>{t('compose.photoLabel', { max: MAX_IMAGES })}</label>
        <div className={styles.imageGrid}>
          {images.map((img, i) => (
            <div key={img.storagePath} className={styles.imageThumbWrap}>
              <img src={img.previewUrl} alt="" className={styles.imageThumb} />
              <button type="button" className={styles.removeImageBtn} onClick={() => handleRemoveImage(i)}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><X size={16} /></span>
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
              {uploading ? t('compose.processingPhoto') : t('compose.addPhoto')}
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
