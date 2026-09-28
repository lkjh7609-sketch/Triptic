import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { HOME_SECTIONS } from './homeSections';
import styles from './HomeSectionTabs.module.css';

/** 홈 영역의 상단 탭(홈 / 항공 / 호텔 / 액티비티). PC는 헤더 "홈" 드롭다운이 대신한다. */
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
