import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tripService } from '@/shared/api/tripService';
import { captureError } from '@/shared/monitoring';
import type { PdfExportInput } from './pdfExport';
import styles from './ShareSheet.module.css';
import { Link, Clipboard, BookOpen, FileText } from 'lucide-react';

interface ShareSheetProps {
  tripId: string;
  onClose: () => void;
  /** 텍스트 복사(index.html copyItineraryText 이식)용 — 없으면 텍스트 복사 버튼을 숨긴다 */
  itineraryText?: string;
  /** PDF 내보내기(index.html exportToPDF 이식)용 — 없으면 PDF 버튼을 숨긴다 */
  pdfInput?: PdfExportInput;
  /** 샘플 여행이면 공유 링크 생성만 막는다 — 텍스트/PDF 내보내기는 legacy도 막지 않는다
   * (index.html openShareModal만 SAMPLE_PROJECT_NAME을 검사하고, openExportModal/
   * copyItineraryText/openPdfModal은 검사하지 않는다) */
  isSample?: boolean;
}

/**
 * 공유 시트 (02-screens.md §3.2 "↗ 아이콘 → 공유 시트")
 * 서비스 레이어(tripService.createShareLink/revokeShareLinks)는 legacy와 동일하게
 * shared_trips 테이블을 쓴다. 공유 링크로 여는 읽기 전용 뷰어 화면(/shared/:code)은
 * 아직 없다 — 이번 라운드는 생성·복사·해제까지만 다룬다.
 * 전체 일정 텍스트 복사(legacy copyItineraryText)도 같은 시트에 얹었다 — 헤더가
 * 이미 버튼 3개로 빽빽해서 별도 아이콘 대신 공유 흐름 안에 자연스럽게 포함시켰다.
 */
export function ShareSheet({ tripId, onClose, itineraryText, pdfInput, isSample }: ShareSheetProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState<'all' | 'current' | null>(null);

  async function handleCreate() {
    setLoading(true);
    try {
      const code = await tripService.createShareLink(tripId);
      setShareCode(code);
    } catch (err) {
      captureError(err, { context: 'createShareLink' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSample) return;
    // 외부 시스템(Supabase RPC) 호출로 shareCode를 채우는 것이 이 effect의 목적
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 시트가 열릴 때 1회만 생성/조회
  }, [isSample]);


  const shareUrl = shareCode ? `${window.location.origin}/shared/${shareCode}` : '';

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      captureError(err, { context: 'copyShareLink' });
    }
  }

  async function handleCopyText() {
    if (!itineraryText) return;
    try {
      await navigator.clipboard.writeText(itineraryText);
      setTextCopied(true);
      setTimeout(() => setTextCopied(false), 2000);
    } catch (err) {
      captureError(err, { context: 'copyItineraryText' });
    }
  }

  async function handleExportPdf(mode: 'all' | 'current') {
    if (!pdfInput || pdfGenerating) return;
    setPdfGenerating(mode);
    try {
      // jsPDF는 html2canvas/dompurify 등 무거운 의존성을 끌고 오므로(gzip
      // ~120KB) 정적 import하면 트립 상세 화면을 열 때마다 같이 로드된다 —
      // PDF 버튼을 실제로 누를 때만 동적 import로 받는다.
      const { exportToPdf } = await import('./pdfExport');
      await exportToPdf(pdfInput, mode);
    } catch (err) {
      captureError(err, { context: 'exportToPdf', mode });
    } finally {
      setPdfGenerating(null);
    }
  }

  async function handleRevoke() {
    if (!window.confirm(t('share.revokeConfirm'))) return;
    setLoading(true);
    try {
      await tripService.revokeShareLinks(tripId);
      setShareCode(null);
      onClose();
    } catch (err) {
      captureError(err, { context: 'revokeShareLinks' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Link size={18} /> {t('share.title')}</span></h2>

        {isSample ? (
          <>
            <p className={styles.desc}>{t('share.sampleMessage')}</p>
            <button type="button" className={styles.secondary} onClick={onClose}>
              {t('common:action.close')}
            </button>
          </>
        ) : (
          <>
            <p className={styles.desc}>
              {t('share.desc')}
            </p>

            <div className={styles.linkRow}>
              <input
                className={styles.linkInput}
                readOnly
                value={loading ? t('share.generatingLink') : shareUrl}
              />
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.danger}
                disabled={!shareCode || loading}
                onClick={handleRevoke}
              >
                {t('share.revoke')}
              </button>
              <button type="button" className={styles.primary} disabled={!shareCode || loading} onClick={handleCopy}>
                {copied ? t('share.copied') : t('common:action.copy')}
              </button>
              <button type="button" className={styles.secondary} onClick={onClose}>
                {t('common:action.close')}
              </button>
            </div>
          </>
        )}

        {itineraryText ? (
          <button type="button" className={styles.secondary} onClick={handleCopyText}>
            {textCopied ? t('share.textCopied') : (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clipboard size={16} /> {t('share.copyText')}</span>)}
          </button>
        ) : null}

        {pdfInput ? (
          <div className={styles.exportRow}>
            <button
              type="button"
              className={styles.secondary}
              disabled={pdfGenerating !== null}
              onClick={() => handleExportPdf('all')}
            >
              {pdfGenerating === 'all' ? t('share.generatingPdf') : (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><BookOpen size={16} /> {t('share.pdfAllBtn', { days: pdfInput.totalDays })}</span>)}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={pdfGenerating !== null}
              onClick={() => handleExportPdf('current')}
            >
              {pdfGenerating === 'current' ? t('share.generatingPdf') : (<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FileText size={16} /> {t('share.pdfCurrentBtn', { day: pdfInput.currentDay })}</span>)}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
