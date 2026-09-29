import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BedDouble, Briefcase, ExternalLink } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { HomeSectionTabs } from './HomeSectionTabs';
import { TripHotelsWidget } from './TripHotelsWidget';
import styles from './SectionScreen.module.css';

/**
 * 호텔 탭 — 넓은 화면(700px 이상)은 트립닷컴 검색창 위젯(표시 언어에 맞춰), 좁은 화면(폰)은 위젯이
 * 가로로 긴 모양(999×222)이라 들어가지 않아 폰용 위젯 코드가 생길 때까지 아고다로 연결한다.
 * 좁은 화면에서는 위젯을 CSS로 숨기지 않고 아예 만들지 않는다(숨겨도 트립닷컴과 쿠키를 주고받게 되므로).
 */
export function HotelsScreen() {
  const { t } = useTranslation('home');
  const wide = useMediaQuery('(min-width: 700px)');

  useEffect(() => {
    trackScreenView('hotels');
  }, []);

  return (
    <div className={styles.page}>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <Briefcase size={22} aria-hidden="true" /> {t('hotels.title')}
          </h1>
          <p className={styles.subtitle}>{t('hotels.subtitle')}</p>
        </header>
        {wide ? (
          <TripHotelsWidget />
        ) : (
          <a href="https://www.agoda.com/" target="_blank" rel="noopener noreferrer" className={styles.cta}>
            <BedDouble size={18} aria-hidden="true" /> {t('hotels.cta')} <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
