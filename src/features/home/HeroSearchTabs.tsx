import { useTranslation } from 'react-i18next';
import { BedDouble, MapPinned, Plane, Ticket, type LucideIcon } from 'lucide-react';
import styles from './HeroSearchTabs.module.css';

export type HeroTab = 'plan' | 'flights' | 'hotels' | 'activities';

const TABS: { key: HeroTab; icon: LucideIcon; label: string }[] = [
  { key: 'plan', icon: MapPinned, label: 'desktop.tabPlan' },
  { key: 'flights', icon: Plane, label: 'sections.flights' },
  { key: 'hotels', icon: BedDouble, label: 'sections.hotels' },
  { key: 'activities', icon: Ticket, label: 'sections.activities' },
];

/**
 * 홈 히어로 검색 카드 위의 탭(여행 계획 / 항공 / 호텔 / 액티비티) — 고르면 아래 검색이 그 종류로 바뀐다.
 * 화면 이동용 탭 줄(HomeSectionTabs)과 달리 이 자리에서 검색 폼을 갈아 끼우는 용도라 알약 모양으로 구분한다.
 */
export function HeroSearchTabs({ active, onChange }: { active: HeroTab; onChange: (tab: HeroTab) => void }) {
  const { t } = useTranslation('home');
  return (
    <div className={styles.tabs} role="group" aria-label={t('desktop.tabsLabel')}>
      {TABS.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          type="button"
          aria-pressed={active === key}
          className={active === key ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          onClick={() => onChange(key)}
        >
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
          {t(label)}
        </button>
      ))}
    </div>
  );
}
