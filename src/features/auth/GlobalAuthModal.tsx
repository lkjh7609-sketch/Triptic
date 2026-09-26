import { Compass, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { LoginButtons } from './LoginButtons';
import { EmailAuthForm } from './EmailAuthForm';
import styles from './GlobalAuthModal.module.css';

interface GlobalAuthModalProps {
  /** 샘플 여행 체험 중에 띄운 경우에만 넘긴다 — 닫으면 샘플로 돌아간다 */
  onClose?: () => void;
}

/**
 * 로그인 화면 (02-screens.md §6). 비로그인 사용자는 앱 전체가 이 화면으로 막히고,
 * 로그인 없이 체험할 수 있는 건 샘플 여행 하나뿐이다(체험 중엔 AppShell의 GuestBanner).
 */
export function GlobalAuthModal({ onClose }: GlobalAuthModalProps) {
  const { t } = useTranslation();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <div className={styles.overlay}>
      <div ref={trapRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="auth-title">
        {onClose ? (
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('action.close')}>
            <X size={20} />
          </button>
        ) : null}

        <div className={styles.header}>
          <div className={styles.brandRow}>
            <Compass size={36} color="var(--brand)" strokeWidth={1.5} aria-hidden="true" />
            <h1 id="auth-title" className={styles.title}>
              Triptic
            </h1>
          </div>
          <p className={styles.subtitle}>{t('auth.signInSubtitle')}</p>
        </div>

        <EmailAuthForm />

        <div className={styles.divider}>{t('auth.or')}</div>

        <LoginButtons />

        {onClose ? null : (
          <div className={styles.sampleBox}>
            <span className={styles.sampleHint}>{t('auth.sampleHint')}</span>
            <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={styles.sampleLink}>
              <Sparkles size={16} aria-hidden="true" /> {t('auth.trySample')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
