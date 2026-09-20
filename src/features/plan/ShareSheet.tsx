import { useEffect, useState } from 'react';
import { tripService } from '@/shared/api/tripService';
import { captureError } from '@/shared/monitoring';
import type { PdfExportInput } from './pdfExport';
import styles from './ShareSheet.module.css';

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

  // basename('/preview')이 라우터에 있어야 /shared/:code가 매치된다 — router.tsx 참고
  const shareUrl = shareCode ? `${window.location.origin}/preview/shared/${shareCode}` : '';

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
    if (!window.confirm('공유를 중단할까요? 더 이상 상대방이 이 여행을 볼 수 없게 돼요.')) return;
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
        <h2 className={styles.title}>🔗 보기 전용 공유 링크</h2>

        {isSample ? (
          <>
            <p className={styles.desc}>샘플 여행은 공유할 수 없습니다. 나만의 새 여행을 만들어 공유해 보세요!</p>
            <button type="button" className={styles.secondary} onClick={onClose}>
              닫기
            </button>
          </>
        ) : (
          <>
            <p className={styles.desc}>
              동행자에게 이 링크를 보내면 편집 없이 일정을 확인할 수 있어요.
            </p>

            <div className={styles.linkRow}>
              <input
                className={styles.linkInput}
                readOnly
                value={loading ? '생성하는 중…' : shareUrl}
              />
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.danger}
                disabled={!shareCode || loading}
                onClick={handleRevoke}
              >
                공유 중단
              </button>
              <button type="button" className={styles.secondary} onClick={onClose}>
                닫기
              </button>
              <button type="button" className={styles.primary} disabled={!shareCode || loading} onClick={handleCopy}>
                {copied ? '복사됨!' : '복사하기'}
              </button>
            </div>
          </>
        )}

        {itineraryText ? (
          <button type="button" className={styles.secondary} onClick={handleCopyText}>
            {textCopied ? '텍스트 복사됨!' : '📋 전체 일정 텍스트로 복사'}
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
              {pdfGenerating === 'all' ? '생성 중…' : `📚 전체 일정 PDF (${pdfInput.totalDays}일치)`}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={pdfGenerating !== null}
              onClick={() => handleExportPdf('current')}
            >
              {pdfGenerating === 'current' ? '생성 중…' : `📄 ${pdfInput.currentDay}일차만 PDF`}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
