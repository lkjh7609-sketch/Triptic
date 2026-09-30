import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { openLoginPrompt } from '@/features/auth/loginPrompt';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import styles from './CtaBanner.module.css';

/** PC 맨 아래 초록 배너 — 로그인한 사람에게는 보이지 않는다 */
export function CtaBanner() {
  const { t } = useTranslation('home');
  const { user } = useSession();
  if (user) return null;

  return (
    <section className={styles.banner} aria-labelledby="home-cta-title">
      <div className={styles.glowA} aria-hidden="true" />
      <div className={styles.glowB} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.text}>
          <span className={styles.tag}>START FOR FREE</span>
          <h2 id="home-cta-title" className={styles.title}>
            {t('page.cta.title')}
          </h2>
          <p className={styles.desc}>{t('page.cta.desc')}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={openLoginPrompt}>
            {t('page.cta.start')}
          </button>
          <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={styles.secondary}>
            {t('page.cta.sample')}
          </Link>
        </div>
      </div>
    </section>
  );
}
