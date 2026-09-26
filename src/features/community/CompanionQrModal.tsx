import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { useMyCompanionQrToken } from './hooks/useCompanionPosts';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './CompanionQrModal.module.css';

interface CompanionQrModalProps {
  postId: string;
  onClose: () => void;
}

/** 매칭 확정 후 내 QR 코드를 보여준다(0032 get_my_companion_qr_token) — 상시 유효, 만료 없음 */
export function CompanionQrModal({ postId, onClose }: CompanionQrModalProps) {
  const { t } = useTranslation(['community', 'common']);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  const { data: token, isLoading, isError, refetch } = useMyCompanionQrToken(postId);

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={focusTrapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('companion.qr.showTitle')}
      >
        <h2 className={modalStyles.title}>{t('companion.qr.showTitle')}</h2>
        <p className={styles.desc}>{t('companion.qr.showDesc')}</p>
        {isLoading ? (
          <Skeleton height="240px" />
        ) : isError || !token ? (
          <ErrorState summary={t('companion.qr.loadError')} onRetry={() => refetch()} />
        ) : (
          <div className={styles.qrWrap}>
            <QRCodeSVG value={token} size={220} marginSize={2} />
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
