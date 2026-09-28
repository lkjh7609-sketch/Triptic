import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { trackScreenView } from '@/shared/monitoring';
import styles from './FlightsScreen.module.css';

/** Travelpayouts White Label(항공권 메타서치) — 색·폰트는 Travelpayouts 대시보드 Design 탭에서 설정 */
const WL_SCRIPT_ID = 'tpwl-script';
const WL_SCRIPT_SRC = 'https://tpembd.com/wl_web/main.js?wl_id=22732';

/** 위젯 스크립트를 넣은 화면 진입(location.key) — StrictMode 이중 실행과 "다시 들어옴"을 구분 */
let scriptLoadedFor: string | null = null;

/**
 * 항공권 검색. 위젯은 페이지를 처음 불러올 때 #tpwl-search/#tpwl-tickets를 한 번 채우는
 * 스크립트라, 앱 안에서 나갔다가 다시 들어오면(스크립트는 이미 로드됨) 새로고침해서
 * 확실히 다시 그리게 한다.
 */
export function FlightsScreen() {
  const { t } = useTranslation('home');
  const { key } = useLocation();

  useEffect(() => {
    trackScreenView('flights');
    if (document.getElementById(WL_SCRIPT_ID)) {
      if (scriptLoadedFor !== key) window.location.reload();
      return;
    }
    scriptLoadedFor = key;
    const script = document.createElement('script');
    script.id = WL_SCRIPT_ID;
    script.type = 'module';
    script.async = true;
    script.src = WL_SCRIPT_SRC;
    document.head.appendChild(script);
  }, [key]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('flights.title')}</h1>
        <p className={styles.subtitle}>{t('flights.subtitle')}</p>
      </header>
      <div id="tpwl-search" />
      <div id="tpwl-tickets" className={styles.tickets} />
    </div>
  );
}
