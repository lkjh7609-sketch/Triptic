import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane, Hotel, Ticket, Calendar, Image, FileText, Trash2 } from 'lucide-react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { hasDocumentUploadConsent, setDocumentUploadConsent } from './consent';
import {
  validateFile,
  ACCEPTED_MIME_TYPES,
  getVoucherSignedUrlByDocumentId,
  type DocumentCategory,
  type ParseBookingResponse,
  type VoucherEntry,
} from './documentService';
import { useUploadDocument, useDocumentsList, useDeleteDocument } from './useDocuments';
import { captureError } from '@/shared/monitoring';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './UploadModal.module.css';

interface UploadModalProps {
  tripId: string;
  onClose: () => void;
  onParsed: (result: ParseBookingResponse) => void;
}

const CATEGORIES: DocumentCategory[] = ['flight', 'lodging', 'other'];

const CATEGORY_ICON: Record<DocumentCategory, React.ReactNode> = {
  flight: <Plane size={20} />,
  lodging: <Hotel size={20} />,
  other: <Ticket size={20} />,
};

function iconFor(entry: VoucherEntry): React.ReactNode {
  if (entry.category) return CATEGORY_ICON[entry.category];
  if (entry.booking?.type === 'flight') return <Plane size={20} />;
  if (entry.booking?.type === 'lodging') return <Hotel size={20} />;
  if (entry.mime_type === 'application/vnd.apple.pkpass') return <Ticket size={20} />;
  if (entry.mime_type === 'text/calendar') return <Calendar size={20} />;
  if (entry.mime_type.startsWith('image/')) return <Image size={20} />;
  return <FileText size={20} />;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 예약 서류 업로드 + 바우처 보관함 (04-document-ai.md §2, 02-screens.md §3.6)
 * 원래 툴바에 따로 있던 "바우처 보관함"을 여기로 합쳤다 — 업로드 버튼과
 * 업로드한 서류 목록이 같은 화면에 있는 게 자연스럽고, 툴바 아이콘도 하나
 * 줄어든다. 업로드 전에 분류(항공권/숙소/다른 예약)를 사용자가 직접
 * 고르게 해서(파싱 실패/오분류와 무관하게) 목록에 바로 반영한다.
 */
export function UploadModal({ tripId, onClose, onParsed }: UploadModalProps) {
  const { t } = useTranslation(['documents', 'common']);
  const [consented, setConsented] = useState(hasDocumentUploadConsent());
  const [category, setCategory] = useState<DocumentCategory | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument(tripId);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);

  const { data: documents, isLoading: documentsLoading } = useDocumentsList(tripId);
  const deleteMutation = useDeleteDocument(tripId);
  const [viewerUrl, setViewerUrl] = useState<{ url: string; mimeType: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function handleAgree() {
    setDocumentUploadConsent(true);
    setConsented(true);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !category) return;
    const err = validateFile(file);
    if (err) {
      setFileError(err);
      return;
    }
    setFileError(null);
    try {
      const result = await upload.mutateAsync({ file, category });
      onParsed(result);
    } catch (err2) {
      captureError(err2, { context: 'uploadAndParseDocument' });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function openViewer(entry: VoucherEntry) {
    setBusyId(entry.id);
    try {
      const url = await getVoucherSignedUrlByDocumentId(entry.id);
      if (!url) return;
      if (entry.mime_type.startsWith('image/')) {
        setViewerUrl({ url, mimeType: entry.mime_type });
      } else {
        window.open(url, '_blank', 'noopener');
      }
    } catch (err) {
      captureError(err, { context: 'openVoucher' });
    } finally {
      setBusyId(null);
    }
  }

  async function handleShare(entry: VoucherEntry) {
    setBusyId(entry.id);
    try {
      const url = await getVoucherSignedUrlByDocumentId(entry.id);
      if (!url) return;
      if (navigator.share) {
        await navigator.share({ title: entry.original_name, url });
      } else {
        window.open(url, '_blank', 'noopener');
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        captureError(err, { context: 'shareVoucher' });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(entry: VoucherEntry) {
    if (!window.confirm(t('archive.deleteConfirm', { name: entry.original_name }))) return;
    setBusyId(entry.id);
    try {
      await deleteMutation.mutateAsync({ id: entry.id, storage_path: entry.storage_path });
    } catch (err) {
      captureError(err, { context: 'deleteVoucher' });
    } finally {
      setBusyId(null);
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
        <p className={styles.consentText}>{t('upload.categoryPrompt')}</p>

        <div className={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={category === c ? styles.categoryBtnActive : styles.categoryBtn}
              onClick={() => setCategory(c)}
            >
              {t(`upload.category.${c}`)}
            </button>
          ))}
        </div>

        <p className={styles.consentText}>{t('upload.fileHint')}</p>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(',')}
          onChange={handleFileChange}
          disabled={upload.isPending || !category}
          className={styles.fileInput}
        />

        {upload.isPending ? <p className={styles.status}>{t('upload.processing')}</p> : null}
        {fileError ? <p className={styles.error}>{fileError}</p> : null}
        {upload.isError ? <p className={styles.error}>{t('upload.uploadError')}</p> : null}

        <h3 className={styles.sectionTitle}>{t('archive.title')}</h3>
        {documentsLoading ? (
          <p className={modalStyles.hint}>{t('state.loading', { ns: 'common' })}</p>
        ) : !documents || documents.length === 0 ? (
          <p className={modalStyles.hint}>{t('archive.empty')}</p>
        ) : (
          <ul className={styles.list}>
            {documents.map((entry) => (
              <li key={entry.id} className={styles.item}>
                <button
                  type="button"
                  className={styles.itemMain}
                  onClick={() => openViewer(entry)}
                  disabled={busyId === entry.id}
                >
                  <span className={styles.icon} aria-hidden="true">
                    {iconFor(entry)}
                  </span>
                  <span className={styles.info}>
                    <span className={styles.name}>{entry.booking?.reference_code || entry.original_name}</span>
                    <span className={styles.date}>{formatDate(entry.created_at)}</span>
                  </span>
                </button>
                <div className={styles.itemActions}>
                  {entry.mime_type === 'application/vnd.apple.pkpass' ? (
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={() => openViewer(entry)}
                      disabled={busyId === entry.id}
                      title={t('archive.addToWallet')}
                    >
                      <Ticket size={16} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleShare(entry)}
                    disabled={busyId === entry.id}
                    title={t('action.share', { ns: 'common' })}
                  >
                    ↗
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtnDanger}
                    onClick={() => handleDelete(entry)}
                    disabled={busyId === entry.id}
                    title={t('action.delete', { ns: 'common' })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('action.close', { ns: 'common' })}
          </button>
        </div>
      </div>

      {viewerUrl ? (
        <div
          className={styles.imageViewerOverlay}
          onClick={(e) => {
            e.stopPropagation();
            setViewerUrl(null);
          }}
        >
          <img src={viewerUrl.url} alt={t('archive.voucherOriginalAlt')} className={styles.imageViewerImg} />
        </div>
      ) : null}
    </div>
  );
}
