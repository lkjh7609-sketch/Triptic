import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { flagInvalid } from '@/shared/ui/invalidField';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { useSession } from '@/shared/hooks/useSession';
import { captureError } from '@/shared/monitoring';
import { submitFeedback } from './feedbackService';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './FeedbackModal.module.css';

const MAX_BODY_LENGTH = 2000;

interface FeedbackModalProps {
  onClose: () => void;
}

/** 설정 화면의 예전 "문의하기"(mailto) 자리를 대신하는 건의하기 — 텍스트 +
 * 선택적 스크린샷을 바로 작성해서 보내면 운영 콘솔에서 확인할 수 있다. */
export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const { t } = useTranslation(['settings', 'common']);
  const { user } = useSession();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [body, setBody] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setScreenshot(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function handleRemoveScreenshot() {
    setScreenshot(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      setError(t('feedback.bodyRequired'));
      flagInvalid(bodyRef.current);
      return;
    }
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitFeedback(user.id, trimmed, screenshot);
      setDone(true);
    } catch (err) {
      captureError(err, { context: 'submitFeedback' });
      setError(t('feedback.submitError'));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className={modalStyles.overlay} onClick={onClose}>
        <div ref={trapRef} className={modalStyles.sheet} role="dialog" aria-modal="true" aria-label={t('feedback.title')} onClick={(e) => e.stopPropagation()}>
          <h2>{t('feedback.title')}</h2>
          <p className={modalStyles.hint}>{t('feedback.submitSuccess')}</p>
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.primary} onClick={onClose}>
              {t('action.close', { ns: 'common' })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <h2 id="feedback-title">{t('feedback.title')}</h2>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="feedback-body">
              {t('feedback.bodyLabel')}
            </label>
            <textarea
              ref={bodyRef}
              id="feedback-body"
              className={styles.textarea}
              value={body}
              maxLength={MAX_BODY_LENGTH}
              onChange={(e) => {
                setBody(e.target.value);
                setError(null);
              }}
              placeholder={t('feedback.bodyPlaceholder')}
              rows={5}
            />
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label}>{t('feedback.screenshotLabel')}</label>
            {previewUrl ? (
              <div className={styles.previewWrap}>
                <img src={previewUrl} alt="" className={styles.previewImg} />
                <button type="button" className={styles.removeBtn} onClick={handleRemoveScreenshot}>
                  {t('action.delete', { ns: 'common' })}
                </button>
              </div>
            ) : (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className={styles.fileInput}
              />
            )}
          </div>
          {error ? (
            <p className={modalStyles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.secondary} onClick={onClose}>
              {t('action.cancel', { ns: 'common' })}
            </button>
            <button type="submit" className={modalStyles.primary} disabled={submitting}>
              {submitting ? t('feedback.submitting') : t('feedback.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
