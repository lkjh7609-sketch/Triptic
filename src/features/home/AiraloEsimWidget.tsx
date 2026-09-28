import { useEffect, useRef } from 'react';
import styles from './FlightsScreen.module.css';

/**
 * Airalo eSIM 위젯(Travelpayouts campaign 541, promo 8588) — 한국어 외 항공 탭 아래.
 * 임베드 스크립트는 자기 자리에 위젯을 그리므로 컨테이너에 스크립트를 넣는다(Klook 위젯과 같은 방식).
 */
const TP_CONTENT_SRC = 'https://tpembd.com/content';
const WIDGET_PARAMS = {
  trs: '578749',
  shmarker: '782766.Hom_Widget',
  locale: 'en',
  powered_by: 'true',
  color_button: '#f2685f',
  color_focused: '#f2685f',
  secondary: '#FFFFFF',
  dark: '#11100f',
  light: '#FFFFFF',
  special: '#C4C4C4',
  border_radius: '5',
  plain: 'false',
  no_labels: 'true',
  promo_id: '8588',
  campaign_id: '541',
};

export function AiraloEsimWidget() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    const script = document.createElement('script');
    script.async = true;
    script.charset = 'utf-8';
    script.src = `${TP_CONTENT_SRC}?${new URLSearchParams(WIDGET_PARAMS).toString()}`;
    host.appendChild(script);
    return () => host.replaceChildren();
  }, []);

  return <div ref={hostRef} className={styles.esimWidget} />;
}
