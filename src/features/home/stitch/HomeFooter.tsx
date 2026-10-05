import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { useSession } from '@/shared/hooks/useSession';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { FeedbackModal } from '@/features/settings/FeedbackModal';
import styles from './HomeFooter.module.css';

/** 이용약관 · 개인정보처리방침 · 고객센터 · 제휴문의 한 줄(넘치면 가운데 정렬로 줄바꿈) + 운영자·호스팅 표기 + 저작권. 고객센터는 설정의 "문의하기"와 같은 창, 제휴문의는 같은 창을 "제휴문의" 제목으로 열고 따로 저장된다(비로그인은 로그인부터) */
export function HomeFooter() {
  const { t } = useTranslation('home');
  // PC(1024px~)는 로그인 여부와 상관없이 항상 보인다. 모바일은 로그인하지 않은 사람에게만 — 로그인하면 같은 링크가
  // 설정 > 정보에 모두 있다(2026-10-05 사용자 결정). 로그인 확인 중에는 모바일에서 그리지 않아 로그인한 사람에게 잠깐 보였다 사라지지 않게 한다
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { user, loading } = useSession();
  const hideOnMobile = loading || !!user;
  const requireLogin = useRequireLogin();
  const [contactKind, setContactKind] = useState<'general' | 'partnership' | null>(null);

  const openContact = (kind: 'general' | 'partnership') => {
    if (requireLogin()) setContactKind(kind);
  };

  if (!desktop && hideOnMobile) return null;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav className={styles.links} aria-label={t('page.footer.navAria')}>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className={styles.link}>
            {t('desktop.terms')}
          </a>
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.link} ${styles.strong}`}
          >
            {t('desktop.privacy')}
          </a>
          <button type="button" className={styles.link} onClick={() => openContact('general')}>
            {t('desktop.contact')}
          </button>
          <button type="button" className={styles.link} onClick={() => openContact('partnership')}>
            {t('page.footer.partnership')}
          </button>
        </nav>
        {/* 항목 중간에서 줄이 끊기지 않게 묶음 단위로 나눈다 — 모바일은 "운영자 · 메일" / "호스팅" 두 줄, PC는 한 줄 */}
        <p className={styles.operator}>
          <span className={styles.group}>
            {t('page.footer.operatorItem')}
            <span className={styles.dot} aria-hidden="true">
              ·
            </span>
            admin@triptic.my
          </span>
          <span className={`${styles.dot} ${styles.pcDot}`} aria-hidden="true">
            ·
          </span>
          <span className={styles.group}>{t('page.footer.hostingItem')}</span>
        </p>
        <p className={styles.copy}>
          &copy; {new Date().getFullYear()} Triptic. All rights reserved.
        </p>
      </div>
      {contactKind ? (
        <FeedbackModal kind={contactKind} onClose={() => setContactKind(null)} />
      ) : null}
    </footer>
  );
}
