import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import { PoweredBy } from '@/shared/ui/PoweredBy';
import { AiraloEsimWidget } from './AiraloEsimWidget';
import styles from './FlightsScreen.module.css';

/** Travelpayouts White Label(항공권 메타서치) — 색·폰트는 Travelpayouts 대시보드 Design 탭에서 설정 */
const WL_SCRIPT_ID = 'tpwl-script';
const WL_SCRIPT_SRC = 'https://tpembd.com/wl_web/main.js?wl_id=22732';

/**
 * 위젯 언어·통화 — 한국어 사용자는 한국어/원화, 그 외는 영어/달러.
 * 위젯은 시작할 때 주소의 language/currency를 저장된 선택보다 먼저 읽는다(읽고 나서 지운다).
 */
function flightsWidgetLocale(appLanguage: string): { language: string; currency: string } {
  return aiLocale(appLanguage) === 'ko' ? { language: 'ko', currency: 'KRW' } : { language: 'en', currency: 'USD' };
}

/**
 * 항공 탭 위젯을 담는 자리. AppShell이 /flights에 처음 들어올 때 한 번 만들고 이후로는
 * 지우지 않고 숨기기/보이기만 한다 — 이 위젯 스크립트는 문서당 한 번 #tpwl-search/
 * #tpwl-tickets를 채우고, 컨테이너를 새로 만들면 다시 그리지 않는다(헤드리스로 확인).
 * 숨겼다 다시 보여주는 건 문제없다. hidden 속성은 display를 주는 클래스에 덮이므로
 * 인라인 display로 숨긴다.
 */
export function FlightsWidgetHost({ visible }: { visible: boolean }) {
  const injectedHere = useRef(false);
  const { t, i18n } = useTranslation('home');

  useEffect(() => {
    if (document.getElementById(WL_SCRIPT_ID)) {
      // 스크립트가 이미 있는 문서에서 이 자리가 새로 생긴 경우(로그아웃 후 재로그인 등)만
      // 새로고침한다. StrictMode의 이펙트 재실행은 같은 인스턴스라 ref로 구분된다.
      if (!injectedHere.current) window.location.reload();
      return;
    }
    injectedHere.current = true;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('language') && !url.searchParams.has('currency')) {
      const { language, currency } = flightsWidgetLocale(i18n.language);
      url.searchParams.set('language', language);
      url.searchParams.set('currency', currency);
      // 라우터 상태(history.state)는 그대로 두고 주소만 바꾼다 — 화면 이동이 아니다
      window.history.replaceState(window.history.state, '', url.href);
    }
    const script = document.createElement('script');
    script.id = WL_SCRIPT_ID;
    script.type = 'module';
    script.async = true;
    script.src = WL_SCRIPT_SRC;
    document.head.appendChild(script);
    // 언어는 위젯이 처음 뜰 때 한 번만 반영된다(이후 앱 언어를 바꿔도 위젯은 그대로)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.widgetHost} style={visible ? undefined : { display: 'none' }}>
      <div id="tpwl-search" />
      <PoweredBy brand="aviasales" align="end" />
      <div id="tpwl-tickets" className={styles.tickets} />
      {/* 항공권 아래 eSIM(한국어는 FlightsEssentials — 유심사·마이리얼트립) */}
      <section className={styles.esim} aria-labelledby="flights-esim-title">
        <div className={styles.esimHead}>
          <div>
            <h2 id="flights-esim-title" className={styles.esimTitle}>
              {t('flights.esimGlobal.title')}
            </h2>
            <p className={styles.esimSubtitle}>{t('flights.esimGlobal.subtitle')}</p>
          </div>
          <PoweredBy brand="airalo" />
        </div>
        <AiraloEsimWidget />
      </section>
    </div>
  );
}
