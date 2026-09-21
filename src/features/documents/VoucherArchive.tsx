import { useState } from 'react';
import { useDeleteDocument, useDocumentsList } from './useDocuments';
import { getVoucherSignedUrlByDocumentId, type VoucherEntry } from './documentService';
import { captureError } from '@/shared/monitoring';
import modalStyles from '../plan/AddPlaceModal.module.css';
import styles from './VoucherArchive.module.css';

interface VoucherArchiveProps {
  tripId: string;
  onClose: () => void;
}

const TYPE_ICON: Record<string, string> = {
  flight: '✈️',
  lodging: '🏨',
  rail: '🚄',
  car_rental: '🚗',
  activity: '🎟',
  restaurant: '🍽',
  insurance: '🛡',
  other: '📍',
};

function iconFor(entry: VoucherEntry): string {
  if (entry.booking) return TYPE_ICON[entry.booking.type] ?? '📄';
  if (entry.mime_type === 'application/vnd.apple.pkpass') return '🎫';
  if (entry.mime_type === 'text/calendar') return '📅';
  if (entry.mime_type.startsWith('image/')) return '🖼';
  return '📄';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 바우처 보관함 (02-screens.md §3.6)
 * 오프라인 우선 자동 다운로드 캐시는 IndexedDB가 없는 현재(Phase 6 미착수)
 * 스코프 밖 — 목록·뷰어·공유·Wallet 추가·삭제만 이번 라운드에서 구현한다.
 * "연결된 일정 항목으로 이동" 링크도 ADR-002에서 itinerary_items.booking_id
 * 역방향 링크를 의도적으로 안 만들기로 해서(부정확한 매칭 방지) 스코프 밖이다.
 */
export function VoucherArchive({ tripId, onClose }: VoucherArchiveProps) {
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
    if (!window.confirm(`'${entry.original_name}'을(를) 삭제할까요? 되돌릴 수 없어요.`)) return;
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
        <h2 className={modalStyles.title}>🎟 바우처 보관함</h2>

        {isLoading ? (
          <p className={modalStyles.hint}>불러오는 중…</p>
        ) : !documents || documents.length === 0 ? (
          <p className={modalStyles.hint}>아직 등록된 바우처가 없어요. "📄 서류로 추가"로 올려보세요.</p>
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
                      title="Apple Wallet에 추가"
                    >
                      🎫
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => handleShare(entry)}
                    disabled={busyId === entry.id}
                    title="공유"
                  >
                    ↗
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtnDanger}
                    onClick={() => handleDelete(entry)}
                    disabled={busyId === entry.id}
                    title="삭제"
                  >
                    🗑
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            닫기
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
          <img src={viewerUrl.url} alt="바우처 원본" className={styles.imageViewerImg} />
        </div>
      ) : null}
    </div>
  );
}
