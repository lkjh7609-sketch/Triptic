import { useRef, useState } from 'react';
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
  const [consented, setConsented] = useState(hasDocumentUploadConsent());
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument(tripId);

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
        <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
          <h2 className={modalStyles.title}>📄 예약 서류로 일정 채우기</h2>
          <p className={styles.consentText}>
            항공권·숙소 확인서 PDF나 사진을 올리면 편명·시각·숙소 같은 정보를 자동으로 읽어 일정 초안을
            만들어 드려요. 여권번호·카드번호 같은 민감정보는 자동 인식(AI) 서버로 보내기 전에 항상
            가려집니다. 인식된 내용은 반드시 직접 확인한 뒤에만 일정에 반영돼요.
          </p>
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.secondary} onClick={onClose}>
              취소
            </button>
            <button type="button" className={modalStyles.primary} onClick={handleAgree}>
              동의하고 계속하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>📄 예약 서류 업로드</h2>
        <p className={styles.consentText}>PDF, JPG, PNG (최대 20MB)</p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={upload.isPending}
          className={styles.fileInput}
        />

        {upload.isPending ? <p className={styles.status}>⏳ 서류를 읽는 중이에요…</p> : null}
        {fileError ? <p className={styles.error}>{fileError}</p> : null}
        {upload.isError ? <p className={styles.error}>업로드 중 오류가 발생했습니다. 다시 시도해 주세요.</p> : null}

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
