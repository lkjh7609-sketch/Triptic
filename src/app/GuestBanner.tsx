import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './GuestBanner.module.css';

/** 비로그인 샘플 여행 체험 중 상단 안내 — 저장되지 않는다는 사실과 로그인 진입점 */
export function GuestBanner({ onLogin }: { onLogin: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        <Sparkles size={16} aria-hidden="true" /> {t('guest.bannerText')}
      </span>
      <button type="button" className={styles.cta} onClick={onLogin}>
        {t('guest.bannerCta')}
      </button>
    </div>
  );
}
