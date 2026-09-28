import { useEffect, useRef } from 'react';
import styles from './FlightsScreen.module.css';

/** Travelpayouts White Label(항공권 메타서치) — 색·폰트는 Travelpayouts 대시보드 Design 탭에서 설정 */
const WL_SCRIPT_ID = 'tpwl-script';
const WL_SCRIPT_SRC = 'https://tpembd.com/wl_web/main.js?wl_id=22732';

/**
 * 항공 탭 위젯을 담는 자리. AppShell이 /flights에 처음 들어올 때 한 번 만들고 이후로는
 * 지우지 않고 숨기기/보이기만 한다 — 이 위젯 스크립트는 문서당 한 번 #tpwl-search/
 * #tpwl-tickets를 채우고, 컨테이너를 새로 만들면 다시 그리지 않는다(헤드리스로 확인).
 * 숨겼다 다시 보여주는 건 문제없다. hidden 속성은 display를 주는 클래스에 덮이므로
 * 인라인 display로 숨긴다.
 */
export function FlightsWidgetHost({ visible }: { visible: boolean }) {
  const injectedHere = useRef(false);

  useEffect(() => {
    if (document.getElementById(WL_SCRIPT_ID)) {
      // 스크립트가 이미 있는 문서에서 이 자리가 새로 생긴 경우(로그아웃 후 재로그인 등)만
      // 새로고침한다. StrictMode의 이펙트 재실행은 같은 인스턴스라 ref로 구분된다.
      if (!injectedHere.current) window.location.reload();
      return;
    }
    injectedHere.current = true;
    const script = document.createElement('script');
    script.id = WL_SCRIPT_ID;
    script.type = 'module';
    script.async = true;
    script.src = WL_SCRIPT_SRC;
    document.head.appendChild(script);
  }, []);

  return (
    <div className={styles.widgetHost} style={visible ? undefined : { display: 'none' }}>
      <div id="tpwl-search" />
      <div id="tpwl-tickets" className={styles.tickets} />
    </div>
  );
}
