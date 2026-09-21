import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { hasDocumentUploadConsent, setDocumentUploadConsent } from './consent';
import { validateFile, ACCEPTED_MIME_TYPES, type ParseBookingResponse } from './documentService';
import { useUploadDocument } from './useDocuments';
import { captureError } from '@/shared/monitoring';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './UploadModal.module.css';

interface UploadModalProps {
  tripId: string;
  onClose: () => void;
  onParsed: (result: ParseBookingResponse) => void;
}

/**
 * 예약 서류 업로드 (04-document-ai.md §2 클라이언트 단계 1~5)
 * 파일 선택 → 사전 검사(§3.2) → 최초 1회 동의(§2 3단계) → 업로드+파싱 요청.
 */
export function UploadModal({ tripId, onClose, onParsed }: UploadModalProps) {
  const { t } = useTranslation(['documents', 'common']);
  const [consented, setConsented] = useState(hasDocumentUploadConsent());
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument(tripId);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);

  function handleAgree() {
    setDocumentUploadConsent(true);
    setConsented(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    try {
      const result = await upload.mutateAsync(file);
      onParsed(result);
    } catch (err2) {
      captureError(err2, { context: 'uploadAndParseDocument' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  if (!consented) {
    return (
      <div className={modalStyles.overlay} onClick={onClose}>
        <div
          ref={focusTrapRef}
          className={modalStyles.sheet}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={t('upload.dialogLabel')}
        >
          <h2 className={modalStyles.title}>{t('upload.title')}</h2>
          <p className={styles.consentText}>{t('upload.consentText')}</p>
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.secondary} onClick={onClose}>
              {t('action.cancel', { ns: 'common' })}
            </button>
            <button type="button" className={modalStyles.primary} onClick={handleAgree}>
              {t('upload.agreeAndContinue')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={focusTrapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('upload.dialogLabel')}
      >
        <h2 className={modalStyles.title}>{t('upload.uploadTitle')}</h2>
        <p className={styles.consentText}>{t('upload.fileHint')}</p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={upload.isPending}
          className={styles.fileInput}
        />

        {upload.isPending ? <p className={styles.status}>{t('upload.processing')}</p> : null}
        {fileError ? <p className={styles.error}>{fileError}</p> : null}
        {upload.isError ? <p className={styles.error}>{t('upload.uploadError')}</p> : null}

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('action.close', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}
