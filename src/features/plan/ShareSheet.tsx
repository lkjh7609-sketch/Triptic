import { useEffect, useState } from 'react';
import { tripService } from '@/shared/api/tripService';
import { captureError } from '@/shared/monitoring';
import styles from './ShareSheet.module.css';

interface ShareSheetProps {
  tripId: string;
  onClose: () => void;
  /** 텍스트 복사(index.html copyItineraryText 이식)용 — 없으면 텍스트 복사 버튼을 숨긴다 */
  itineraryText?: string;
}

/**
 * 공유 시트 (02-screens.md §3.2 "↗ 아이콘 → 공유 시트")
 * 서비스 레이어(tripService.createShareLink/revokeShareLinks)는 legacy와 동일하게
 * shared_trips 테이블을 쓴다. 공유 링크로 여는 읽기 전용 뷰어 화면(/shared/:code)은
 * 아직 없다 — 이번 라운드는 생성·복사·해제까지만 다룬다.
 * 전체 일정 텍스트 복사(legacy copyItineraryText)도 같은 시트에 얹었다 — 헤더가
 * 이미 버튼 3개로 빽빽해서 별도 아이콘 대신 공유 흐름 안에 자연스럽게 포함시켰다.
 */
export function ShareSheet({ tripId, onClose, itineraryText }: ShareSheetProps) {
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [textCopied, setTextCopied] = useState(false);

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
    // 외부 시스템(Supabase RPC) 호출로 shareCode를 채우는 것이 이 effect의 목적
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 시트가 열릴 때 1회만 생성/조회
  }, []);

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
          <button type="button" className={styles.danger} disabled={!shareCode || loading} onClick={handleRevoke}>
            공유 중단
          </button>
          <button type="button" className={styles.secondary} onClick={onClose}>
            닫기
          </button>
          <button type="button" className={styles.primary} disabled={!shareCode || loading} onClick={handleCopy}>
            {copied ? '복사됨!' : '복사하기'}
          </button>
        </div>

        {itineraryText ? (
          <button type="button" className={styles.secondary} onClick={handleCopyText}>
            {textCopied ? '텍스트 복사됨!' : '📋 전체 일정 텍스트로 복사'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
