import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import heroImage from '@/assets/home/hero.webp';
import { CAPSULE_TABS as TABS, type CapsuleTabKey } from './capsuleTabs';
import { HomeTopBar } from './HomeTopBar';
import { useLiquidGlass } from './useLiquidGlass';
import styles from './HeroTabs.module.css';

/**
 * 항공·호텔·투어 캡슐. 홈에서는 이동 버튼이라 처음엔 아무것도 채우지 않고, 누르면 그 칸이 채워지며 해당 화면으로 간다.
 * 항공·호텔·투어 화면에서는 activeKey로 지금 화면의 칸이 채워져 있고(aria-current), 다른 칸을 누르면 그 화면으로 간다.
 */
function CapsuleTabs({ variant, activeKey }: { variant: 'hero' | 'flat'; activeKey?: CapsuleTabKey }) {
  const { t } = useTranslation('home');
  const navigate = useNavigate();
  const [picked, setPicked] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  // 히어로 캡슐만: 뒤 사진이 가장자리에서 휘어 보이는 굴절(크롬 계열). 그 밖의 브라우저는 블러 유리 그대로
  const glass = useLiquidGlass(navRef);
  const refract = variant === 'hero' && glass.refracting;
  const current = activeKey ?? picked;

  return (
    <nav
      ref={navRef}
      className={`${styles.capsule} ${variant === 'hero' ? styles.capsuleHero : styles.capsuleFlat} ${refract ? styles.capsuleRefract : ''}`}
      style={refract ? { backdropFilter: `blur(3px) ${glass.filterUrl} saturate(1.5) brightness(1.08)` } : undefined}
      aria-label={t('page.tabs.label')}
    >
      {variant === 'hero' ? glass.svg : null}
      {TABS.map(({ key, to, Icon }) => (
        <button
          key={key}
          type="button"
          className={`${styles.tab} ${current === key ? styles.tabOn : ''}`}
          aria-current={activeKey === key ? 'page' : undefined}
          onClick={() => {
            if (activeKey === key) return;
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

/** PC: 항공·호텔·투어 화면 맨 위의 얇은 사진 띠 + 유리 캡슐(홈 히어로의 축소판) */
export function SectionBandDesktop({ activeKey }: { activeKey?: CapsuleTabKey }) {
  return (
    <section className={`${styles.hero} ${styles.band}`}>
      <img src={heroImage} alt="" className={styles.heroImage} decoding="async" />
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.wave} aria-hidden="true">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" fill="currentColor">
          <path d="M0,32 C320,78 480,10 720,48 C960,86 1120,18 1440,42 L1440,80 L0,80 Z" />
        </svg>
      </div>
      <div className={styles.heroInner}>
        <CapsuleTabs variant="hero" activeKey={activeKey} />
      </div>
    </section>
  );
}

/** 모바일: 항공·호텔·투어 화면 맨 위의 로고 줄 + 유리 캡슐(홈과 같은 자리, 캡슐은 스크롤과 함께 올라감) */
export function SectionCapsuleMobile({ activeKey }: { activeKey?: CapsuleTabKey }) {
  return (
    <>
      <HomeTopBar />
      <div className={styles.sectionCapsuleMobile}>
        <CapsuleTabs variant="flat" activeKey={activeKey} />
      </div>
    </>
  );
}
