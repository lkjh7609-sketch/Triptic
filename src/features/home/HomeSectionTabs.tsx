import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { HOME_SECTIONS } from './homeSections';
import styles from './HomeSectionTabs.module.css';

/** 홈 영역의 상단 탭(홈 / 항공 / 호텔 / 액티비티). 모바일은 큰 제목형, PC는 헤더 아래 탭 줄(CSS). */
export function HomeSectionTabs() {
  const { t } = useTranslation('home');
  return (
    <nav className={styles.tabs} aria-label={t('sections.label')}>
      {HOME_SECTIONS.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end
          className={({ isActive }) => (isActive ? `${styles.tab} ${styles.active}` : styles.tab)}
        >
          {t(`sections.${s.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
