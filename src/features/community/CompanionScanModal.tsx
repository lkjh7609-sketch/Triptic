import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QrScanner from 'qr-scanner';
import { Camera, ImagePlus } from 'lucide-react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { useSession } from '@/shared/hooks/useSession';
import { useVerifyCompanionQrToken } from './hooks/useCompanionPosts';
import type { VerifiedCompanionMember } from './companionService';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './CompanionScanModal.module.css';

interface CompanionScanModalProps {
  onClose: () => void;
}

/**
 * 상대방 QR을 스캔해 같은 매칭 멤버가 맞는지 확인한다(0032
 * verify_companion_qr_token) — 실패 이유는 구분해서 보여주지 않는다(서버도
 * 그렇게 설계돼 있다). 카메라 스트림은 보안 컨텍스트(https/localhost)에서만
 * 열리므로, 파일 업로드 폴백(QrScanner.scanImage)을 항상 같이 제공한다.
 */
export function CompanionScanModal({ onClose }: CompanionScanModalProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifiedCompanionMember | null | undefined>(undefined);
  const verifyMutation = useVerifyCompanionQrToken(user?.id ?? null);

  async function handleToken(token: string) {
    scannerRef.current?.stop();
    try {
      const verified = await verifyMutation.mutateAsync(token);
      setResult(verified);
    } catch {
      setResult(null);
    }
  }

  useEffect(() => {
    if (!videoRef.current || result !== undefined) return;
    const scanner = new QrScanner(
      videoRef.current,
      (r) => handleToken(r.data),
      { preferredCamera: 'environment', highlightScanRegion: true, returnDetailedScanResult: true },
    );
    scannerRef.current = scanner;
    scanner.start().catch(() => setCameraError(t('companion.qr.cameraDenied')));
    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const decoded = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      await handleToken(decoded.data);
    } catch {
      setResult(null);
    }
  }

  function handleRetry() {
    setResult(undefined);
    setCameraError(null);
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={focusTrapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('companion.qr.scanTitle')}
      >
        <h2 className={modalStyles.title}>{t('companion.qr.scanTitle')}</h2>

        {result === undefined ? (
          <>
            <div className={styles.videoWrap}>
              <video ref={videoRef} className={styles.video} muted playsInline autoPlay />
            </div>
            {cameraError ? <p className={styles.error}>{cameraError}</p> : null}
            <label className={styles.filePickLabel}>
              <ImagePlus size={18} aria-hidden="true" />
              <span>{t('companion.qr.uploadInstead')}</span>
              <input type="file" accept="image/*" className={styles.fileInput} onChange={handleFilePick} />
            </label>
          </>
        ) : result ? (
          <div className={styles.resultOk}>
            <p className={styles.resultTitle}>{t('companion.qr.verified')}</p>
            <div className={styles.resultProfile}>
              {result.avatar_url ? (
                <img src={result.avatar_url} alt="" className={styles.avatar} />
              ) : (
                <span className={styles.avatarFallback}>{(result.display_name || '?').slice(0, 1)}</span>
              )}
              <div>
                <p className={styles.resultName}>{result.display_name}</p>
                <p className={styles.resultTrip}>{result.title}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.resultFail}>
            <Camera size={32} aria-hidden="true" />
            <p>{t('companion.qr.verifyFailed')}</p>
            <button type="button" className={modalStyles.primary} onClick={handleRetry}>
              {t('companion.qr.retry')}
            </button>
          </div>
        )}

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primary} onClick={onClose}>
            {t('action.close', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}
