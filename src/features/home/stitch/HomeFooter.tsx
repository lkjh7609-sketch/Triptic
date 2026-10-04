import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { FeedbackModal } from '@/features/settings/FeedbackModal';
import styles from './HomeFooter.module.css';

/** 이용약관 · 개인정보처리방침 · 고객센터 · 제휴문의 + 저작권. 고객센터는 설정의 "문의하기"와 같은 창, 제휴문의는 같은 창을 "제휴문의" 제목으로 열고 따로 저장된다(비로그인은 로그인부터) */
export function HomeFooter() {
  const { t } = useTranslation('home');
  const requireLogin = useRequireLogin();
  const [contactKind, setContactKind] = useState<'general' | 'partnership' | null>(null);

  const openContact = (kind: 'general' | 'partnership') => {
    if (requireLogin()) setContactKind(kind);
  };

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.links}>
          <Link to="/guide" className={styles.link}>
            {t('page.footer.guide')}
          </Link>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <Link to="/notices" className={styles.link}>
            {t('page.footer.notices')}
          </Link>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className={styles.link}>
            {t('desktop.terms')}
          </a>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className={`${styles.link} ${styles.strong}`}>
            {t('desktop.privacy')}
          </a>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <button type="button" className={styles.link} onClick={() => openContact('general')}>
            {t('desktop.contact')}
          </button>
          <span className={styles.sep} aria-hidden="true">
            ·
          </span>
          <button type="button" className={styles.link} onClick={() => openContact('partnership')}>
            {t('page.footer.partnership')}
          </button>
        </div>
        <div className={styles.copy}>{t('page.footer.operator')}</div>
        <div className={styles.copy}>&copy; {new Date().getFullYear()} Triptic. All rights reserved.</div>
      </div>
      {contactKind ? <FeedbackModal kind={contactKind} onClose={() => setContactKind(null)} /> : null}
    </footer>
  );
}
