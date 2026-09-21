import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import styles from './TabBar.module.css';

interface TabDef {
  to: string;
  labelKey: string;
  icon: string;
}

// 01-design-system.md §6.1: 홈 / 계획 / 커뮤니티 / 설정
const TABS: TabDef[] = [
  { to: '/', labelKey: 'tab.home', icon: '🏠' },
  { to: '/plan', labelKey: 'tab.plan', icon: '🗺️' },
  { to: '/community', labelKey: 'tab.community', icon: '💬' },
  { to: '/settings', labelKey: 'tab.settings', icon: '⚙️' },
];

function isTabActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * 하단 탭바 (01-design-system.md §6.1)
 * - 높이 56px + 안전영역, role="tablist" / 각 항목 role="tab" + aria-selected
 * - 터치 타깃 최소 44×44pt
 * - 지도 전체화면 모드에서도 숨기지 않는다 (§6.1) — Phase 2에서 지도 뷰 연동 시 유지
 */
export function TabBar() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <nav className={`${styles.tabBar} tab-bar`} role="tablist" aria-label={t('nav.primary')}>
      {TABS.map((tab) => {
        const active = isTabActive(pathname, tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            role="tab"
            aria-selected={active}
            className={`${styles.tab} ${active ? styles.active : ''}`}
          >
            <span className={styles.icon} aria-hidden="true">
              {tab.icon}
            </span>
            <span className={styles.label}>{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
