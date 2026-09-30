import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane, Hotel, Ticket, Calendar, Image, FileText, Trash2, X } from 'lucide-react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { clearInvalid, flagInvalid } from '@/shared/ui/invalidField';
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
import { captureError, track } from '@/shared/monitoring';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './UploadModal.module.css';

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE = 10;

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
  const categoryRowRef = useRef<HTMLDivElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadDocument(tripId);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);

  const { data: documents, isLoading: documentsLoading } = useDocumentsList(tripId);
  const deleteMutation = useDeleteDocument(tripId);
  const [viewerUrl, setViewerUrl] = useState<{ url: string; mimeType: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<VoucherEntry | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);

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
      track('document_uploaded');
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
    setBusyId(entry.id);
    try {
      await deleteMutation.mutateAsync({ id: entry.id, storage_path: entry.storage_path });
    } catch (err) {
      captureError(err, { context: 'deleteVoucher' });
    } finally {
      setBusyId(null);
    }
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  /** 롱프레스가 끝나는 mouseup 시점엔 이미 ConfirmDialog가 그 자리를 덮고
   * 있어서, 브라우저가 만드는 합성 click의 target이 mousedown 지점(itemMain
   * 버튼)과 mouseup 지점(다이얼로그)의 공통 조상 — 즉 이 모달의 최상위
   * overlay div — 가 돼버린다. 그 click을 캡처 단계에서 가로채 삼킨다. */
  function swallowNextClick() {
    function handler(e: MouseEvent) {
      e.stopPropagation();
      e.preventDefault();
      window.removeEventListener('click', handler, true);
    }
    window.addEventListener('click', handler, true);
    window.setTimeout(() => window.removeEventListener('click', handler, true), 300);
  }

  function handleItemPointerDown(e: React.PointerEvent, entry: VoucherEntry) {
    longPressStartRef.current = { x: e.clientX, y: e.clientY };
    longPressFiredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      setConfirmDeleteEntry(entry);
      swallowNextClick();
    }, LONG_PRESS_MS);
  }

  function handleItemPointerMove(e: React.PointerEvent) {
    const start = longPressStartRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_TOLERANCE) {
      clearLongPressTimer();
    }
  }

  function handleItemPointerEnd() {
    clearLongPressTimer();
  }

  function handleItemClick(entry: VoucherEntry) {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    openViewer(entry);
  }

  if (!consented) {
    return (
      <div className={modalStyles.overlay}>
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
    <div className={modalStyles.overlay}>
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

        <div ref={categoryRowRef} className={styles.categoryRow}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={category === c ? styles.categoryBtnActive : styles.categoryBtn}
              onClick={() => {
                setCategory(c);
                clearInvalid(categoryRowRef.current);
              }}
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
          disabled={upload.isPending}
          onClick={(e) => {
            if (!category) {
              e.preventDefault();
              flagInvalid(categoryRowRef.current);
            }
          }}
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
                  onClick={() => handleItemClick(entry)}
                  onPointerDown={(e) => handleItemPointerDown(e, entry)}
                  onPointerMove={handleItemPointerMove}
                  onPointerUp={handleItemPointerEnd}
                  onPointerLeave={handleItemPointerEnd}
                  onPointerCancel={handleItemPointerEnd}
                  onContextMenu={(e) => e.preventDefault()}
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
                    onClick={() => setConfirmDeleteEntry(entry)}
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
        <div className={styles.imageViewerOverlay}>
          <button
            type="button"
            className={styles.imageViewerClose}
            onClick={() => setViewerUrl(null)}
            aria-label={t('action.close', { ns: 'common' })}
          >
            <X size={22} />
          </button>
          <img src={viewerUrl.url} alt={t('archive.voucherOriginalAlt')} className={styles.imageViewerImg} />
        </div>
      ) : null}

      {confirmDeleteEntry ? (
        <ConfirmDialog
          title={t('archive.deleteConfirmTitle')}
          message={t('archive.deleteConfirm', { name: confirmDeleteEntry.original_name })}
          cancelLabel={t('archive.deleteKeep')}
          confirmLabel={t('action.delete', { ns: 'common' })}
          danger
          onClose={() => setConfirmDeleteEntry(null)}
          onConfirm={() => handleDelete(confirmDeleteEntry)}
        />
      ) : null}
    </div>
  );
}
