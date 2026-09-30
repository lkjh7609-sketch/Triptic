import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Building2, PlaneTakeoff, Ticket } from 'lucide-react';
import heroImage from '@/assets/home/hero.webp';
import styles from './HeroTabs.module.css';

const TABS = [
  { key: 'flights', to: '/flights', Icon: PlaneTakeoff },
  { key: 'hotels', to: '/hotels', Icon: Building2 },
  { key: 'tours', to: '/activities', Icon: Ticket },
] as const;

/** 항공·호텔·투어 캡슐. 홈에서는 이동 버튼이라 처음엔 아무것도 채우지 않고, 누르면 그 칸이 채워지며 해당 화면으로 간다 */
function CapsuleTabs({ variant }: { variant: 'hero' | 'flat' }) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <nav className={`${styles.capsule} ${variant === 'hero' ? styles.capsuleHero : styles.capsuleFlat}`} aria-label={t('page.tabs.label')}>
      {TABS.map(({ key, to, Icon }) => (
        <button
          key={key}
          type="button"
          className={`${styles.tab} ${picked === key ? styles.tabOn : ''}`}
          onClick={() => {
            setPicked(key);
            navigate(to);
          }}
        >
          <Icon size={17} aria-hidden="true" className={styles.tabIcon} />
          <span>{t(`page.tabs.${key}`)}</span>
        </button>
      ))}
    </nav>
  );
}

/** PC: 배경 사진 + 유리 캡슐 탭 + 큰 제목 */
export function HeroDesktop() {
  const { t } = useTranslation('home');
  return (
    <section className={styles.hero}>
      <img src={heroImage} alt="" className={styles.heroImage} fetchPriority="high" decoding="async" />
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.wave} aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" fill="currentColor">
          <path d="M0,32 C320,78 480,10 720,48 C960,86 1120,18 1440,42 L1440,80 L0,80 Z" />
        </svg>
      </div>
      <div className={styles.heroInner}>
        <CapsuleTabs variant="hero" />
        <h1 className={styles.heroTitle}>{t('page.hero.title')}</h1>
        <p className={styles.heroSub}>{t('page.hero.sub')}</p>
      </div>
    </section>
  );
}

/** 모바일: 큰 사진 없이 본문 맨 위의 캡슐 탭 */
export function CapsuleMobile() {
  return <CapsuleTabs variant="flat" />;
}
