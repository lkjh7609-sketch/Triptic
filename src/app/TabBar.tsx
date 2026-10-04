import React from 'react';
import { CircleUser, Home, LogIn, Luggage, PlaneTakeoff, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { isHomeSectionPath } from '@/features/home/homeSections';
import styles from './TabBar.module.css';

interface TabDef {
  to: string;
  labelKey: string;
  icon: React.ReactNode;
}

// 모바일 하단 탭(홈 시안): 홈 / 내 여행 / 커뮤니티 / 공항 / 마이. 경로는 그대로(/plan, /settings) — 이름·아이콘만 시안대로. PC 헤더의 '계획' 라벨은 그대로
const TABS: TabDef[] = [
  { to: '/', labelKey: 'tab.home', icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Home size={16} /></span> },
  { to: '/plan', labelKey: 'tab.myTrips', icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Luggage size={16} /></span> },
  { to: '/community', labelKey: 'tab.community', icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Users size={16} /></span> },
  { to: '/airports', labelKey: 'tab.airport', icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><PlaneTakeoff size={16} /></span> },
  { to: '/settings', labelKey: 'tab.my', icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CircleUser size={16} /></span> },
];

function isTabActive(pathname: string, to: string): boolean {
  // 홈 탭은 홈 상단 탭(항공·호텔·액티비티)에서도 켜져 있다
  if (to === '/') return isHomeSectionPath(pathname);
  return pathname === to || pathname.startsWith(`${to}/`);
}

/**
 * 하단 탭바 (01-design-system.md §6.1)
 * - 높이 56px + 안전영역, role="tablist" / 각 항목 role="tab" + aria-selected
 * - 터치 타깃 최소 44×44pt
 * - 지도 전체화면 모드에서도 숨기지 않는다 (§6.1) — Phase 2에서 지도 뷰 연동 시 유지
 */
export function TabBar({ guest = false }: { guest?: boolean }) {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <nav className={`${styles.tabBar} tab-bar`} role="tablist" aria-label={t('nav.primary')}>
      {TABS.map((rawTab) => {
        // 비로그인: 모바일에는 헤더의 로그인 버튼이 없어서, 설정 칸이 로그인 칸이 된다(누르면 로그인 창)
        const tab: TabDef =
          guest && rawTab.to === '/settings'
            ? {
                ...rawTab,
                labelKey: 'auth.signIn',
                icon: <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><LogIn size={16} /></span>,
              }
            : rawTab;
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
