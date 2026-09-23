import React from 'react';
import { Plane, Hotel, Train, Car, Ticket, Utensils, Shield, MapPin, FileText, Calendar, Image, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteDocument, useDocumentsList } from './useDocuments';
import { getVoucherSignedUrlByDocumentId, type VoucherEntry } from './documentService';
import { captureError } from '@/shared/monitoring';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './VoucherArchive.module.css';

interface VoucherArchiveProps {
  tripId: string;
  onClose: () => void;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  flight: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Plane size={16} /></span>,
  lodging: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Hotel size={16} /></span>,
  rail: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Train size={16} /></span>,
  car_rental: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Car size={16} /></span>,
  activity: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ticket size={16} /></span>,
  restaurant: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Utensils size={16} /></span>,
  insurance: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Shield size={16} /></span>,
  other: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} /></span>,
};

function iconFor(entry: VoucherEntry): React.ReactNode {
  if (entry.booking) return TYPE_ICON[entry.booking.type] ?? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FileText size={16} /></span>;
  if (entry.mime_type === 'application/vnd.apple.pkpass') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ticket size={16} /></span>;
  if (entry.mime_type === 'text/calendar') return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Calendar size={16} /></span>;
  if (entry.mime_type.startsWith('image/')) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Image size={16} /></span>;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FileText size={16} /></span>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 바우처 보관함 (02-screens.md §3.6)
 * 이 화면의 문서 목록 조회(useDocumentsList → useQuery)는 App.tsx의
 * PersistQueryClientProvider가 전체 쿼리 캐시를 IndexedDB에 자동 영속화하므로
 * "여행 시작 3일 전 자동 다운로드" 중 목록 데이터 자체는 이미 오프라인
 * 캐시된다(src/shared/offline/persister.ts) — 실제 바우처 파일(PDF/이미지
 * 바이너리) 프리페치는 스코프 밖(Phase 6 다국어/접근성 라운드에서는 문자열
 * i18n 전환만 다룬다). "연결된 일정 항목으로 이동" 링크도 ADR-002에서
 * itinerary_items.booking_id 역방향 링크를 의도적으로 안 만들기로 해서(부정확한
 * 매칭 방지) 스코프 밖이다.
 */
export function VoucherArchive({ tripId, onClose }: VoucherArchiveProps) {
  const { t } = useTranslation(['documents', 'common']);
  const { data: documents, isLoading } = useDocumentsList(tripId);
  const deleteMutation = useDeleteDocument(tripId);
  const [viewerUrl, setViewerUrl] = useState<{ url: string; mimeType: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function openViewer(entry: VoucherEntry) {
    setBusyId(entry.id);
    try {
      const url = await getVoucherSignedUrlByDocumentId(entry.id);
      if (!url) return;
      if (entry.mime_type.startsWith('image/')) {
        setViewerUrl({ url, mimeType: entry.mime_type });
      } else {
        // PDF·.pkpass·.ics는 브라우저/OS 기본 처리기가 이미 원본 파일 형식을 그대로
        // 렌더링/처리할 수 있어(WKWebView도 PDF 인라인 렌더링·pkpass는 Wallet 유도를
        // 지원) 별도 pdf.js 뷰어를 추가하지 않았다 — ReviewSheet.openVoucher와 동일한
        // 결정.
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
      // 사용자가 공유 시트를 취소한 경우(AbortError)는 에러가 아니다
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

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>{t('archive.title')}</h2>

        {isLoading ? (
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ticket size={16} /></span>
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
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Trash2 size={16} /></span>
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
