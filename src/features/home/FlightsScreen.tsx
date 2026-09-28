import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { trackScreenView } from '@/shared/monitoring';
import styles from './FlightsScreen.module.css';

/**
 * 항공 탭. 검색 위젯 자체는 AppShell의 FlightsWidgetHost가 이 화면 아래에 계속 붙여 둔다
 * (탭을 오갈 때마다 위젯을 새로 만들면 다시 그려지지 않아서).
 */
export function FlightsScreen() {
  const { t } = useTranslation('home');

  useEffect(() => {
    trackScreenView('flights');
  }, []);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('flights.title')}</h1>
        <p className={styles.subtitle}>{t('flights.subtitle')}</p>
      </header>
    </div>
  );
}
