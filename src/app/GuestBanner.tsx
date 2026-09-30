import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './GuestBanner.module.css';

/** 비로그인 샘플·임시 여행 화면 상단 안내 — 샘플은 저장되지 않는다는 것, 임시 여행은 이 기기에만 저장된다는 것과 로그인 진입점 */
export function GuestBanner({ onLogin, draft = false }: { onLogin: () => void; draft?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>
        <Sparkles size={16} aria-hidden="true" /> {t(draft ? 'guest.draftBannerText' : 'guest.bannerText')}
      </span>
      <button type="button" className={styles.cta} onClick={onLogin}>
        {t(draft ? 'guest.draftBannerCta' : 'guest.bannerCta')}
      </button>
    </div>
  );
}
