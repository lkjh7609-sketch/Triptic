import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plane } from 'lucide-react';
import { trackScreenView } from '@/shared/monitoring';
import { flightsProviderFor } from '@/features/plan/flightsSearchLink';
import { HomeSectionTabs } from './HomeSectionTabs';
import { MyrealtripFlightSearch } from './MyrealtripFlightSearch';
import styles from './FlightsScreen.module.css';

/**
 * 항공 탭. 한국어는 마이리얼트립 검색 폼(결과는 마이리얼트립 사이트), 그 외 언어는
 * Travelpayouts 위젯 — 위젯은 AppShell의 FlightsWidgetHost가 이 화면 아래에 계속 붙여 둔다
 * (탭을 오갈 때마다 위젯을 새로 만들면 다시 그려지지 않아서).
 */
export function FlightsScreen() {
  const { t, i18n } = useTranslation('home');
  const provider = flightsProviderFor(i18n.language);

  useEffect(() => {
    trackScreenView('flights');
  }, []);

  return (
    <>
      <HomeSectionTabs />
      <div className={styles.wrap}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <Plane size={22} aria-hidden="true" /> {t('flights.title')}
          </h1>
          <p className={styles.subtitle}>{t('flights.subtitle')}</p>
        </header>
        {provider === 'myrealtrip' ? <MyrealtripFlightSearch /> : null}
      </div>
    </>
  );
}
