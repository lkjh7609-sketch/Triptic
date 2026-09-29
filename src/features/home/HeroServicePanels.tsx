import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BedDouble, ExternalLink, Plane } from 'lucide-react';
import { flightsProviderFor } from '@/features/plan/flightsSearchLink';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { readActivityProvider, type ActivityProvider } from './activityProviders';
import { ActivitySearchForm } from './ActivitySearchForm';
import { HOTELS_PARTNER_URL } from './hotelsPartner';
import styles from './HeroServicePanels.module.css';

// 항공 검색 폼은 무겁고(달력·자동완성) 탭을 열 때만 필요해서 그때 받는다
const MyrealtripFlightSearch = lazy(() =>
  import('./MyrealtripFlightSearch').then((m) => ({ default: m.MyrealtripFlightSearch })),
);

/** 항공 — 한국어는 마이리얼트립 검색 폼을 그대로 홈에서. 그 밖의 언어는 Travelpayouts 위젯이 항공 화면에만
 * 붙어 있어서(AppShell의 FlightsWidgetHost) 홈에 넣을 수 없으니 항공 화면으로 안내한다 */
export function HeroFlightsPanel() {
  const { t, i18n } = useTranslation('home');
  if (flightsProviderFor(i18n.language) === 'myrealtrip') {
    return (
      <div className={styles.panel}>
        <Suspense fallback={<Skeleton height="220px" radius="var(--radius-lg)" />}>
          <MyrealtripFlightSearch embedded />
        </Suspense>
      </div>
    );
  }
  return (
    <div className={`${styles.panel} ${styles.cta}`}>
      <Plane size={28} aria-hidden="true" className={styles.ctaIcon} />
      <p className={styles.ctaText}>{t('flights.subtitle')}</p>
      <Link to="/flights" className={styles.ctaButton}>
        {t('flights.title')} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

/** 호텔 — 호텔 화면과 같은 제휴 링크로 바로(화면이 한 줄짜리 버튼뿐이라 한 번 더 거치지 않게) */
export function HeroHotelsPanel() {
  const { t } = useTranslation('home');
  return (
    <div className={`${styles.panel} ${styles.cta}`}>
      <BedDouble size={28} aria-hidden="true" className={styles.ctaIcon} />
      <p className={styles.ctaText}>{t('hotels.subtitle')}</p>
      <a href={HOTELS_PARTNER_URL} target="_blank" rel="noopener noreferrer" className={styles.ctaButton}>
        {t('hotels.cta')} <ExternalLink size={14} aria-hidden="true" />
      </a>
    </div>
  );
}

/** 액티비티 — 액티비티 화면과 같은 검색(제휴사 고르고 키워드 검색) */
export function HeroActivitiesPanel() {
  const [provider, setProvider] = useState<ActivityProvider>(readActivityProvider);
  return (
    <div className={styles.panel}>
      <ActivitySearchForm provider={provider} onProviderChange={setProvider} />
    </div>
  );
}
