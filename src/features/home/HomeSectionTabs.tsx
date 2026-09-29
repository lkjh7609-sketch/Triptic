import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { HOME_SECTIONS } from './homeSections';
import styles from './HomeSectionTabs.module.css';

/** 홈 영역의 상단 탭(홈 / 항공 / 호텔 / 액티비티). 모바일은 큰 제목형, PC는 헤더 아래 탭 줄(CSS).
 * PC는 헤더에 이미 "홈"이 있어서 이 줄에서는 홈 탭을 감춘다(homeTab, CSS). 모바일은 헤더가 없어 그대로. */
export function HomeSectionTabs() {
  const { t } = useTranslation('home');
  return (
    <nav className={styles.tabs} aria-label={t('sections.label')}>
      {HOME_SECTIONS.map((s) => (
        <NavLink
          key={s.to}
          to={s.to}
          end
          className={({ isActive }) =>
            [styles.tab, isActive ? styles.active : '', s.to === '/' ? styles.homeTab : ''].filter(Boolean).join(' ')
          }
        >
          {t(`sections.${s.key}`)}
        </NavLink>
      ))}
    </nav>
  );
}
