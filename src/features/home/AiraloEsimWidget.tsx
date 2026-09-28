import { useEffect, useRef } from 'react';
import { useResolvedTheme } from '@/shared/theme';
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
  plain: 'false',
  no_labels: 'true',
  promo_id: '8588',
  campaign_id: '541',
};

/**
 * 위젯 색을 우리 디자인 토큰(tokens.css)에서 읽어 넘긴다 — 라이트/다크 둘 다 사이트와 같은 색.
 * 위젯이 받는 값: color_button(버튼), secondary(배경), dark(글자), light(입력칸), special(테두리),
 * border_radius. 버튼 글자색은 위젯이 버튼 색에 맞춰 흰색/검은색을 고른다.
 */
function themeParams(): Record<string, string> {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const brand = token('--brand', '#0D9488');
  return {
    color_button: brand,
    color_focused: brand,
    secondary: token('--surface-card', '#FFFFFF'),
    dark: token('--text-primary', '#1C1917'),
    light: token('--surface-card', '#FFFFFF'),
    special: token('--border', '#E7E5E4'),
    border_radius: String(parseInt(token('--radius-md', '12px'), 10) || 12),
  };
}

export function AiraloEsimWidget() {
  const hostRef = useRef<HTMLDivElement>(null);
  // 테마를 바꾸면 새 색으로 다시 그린다(같은 자리에 다시 넣어도 잘 그려지는 것 확인)
  const theme = useResolvedTheme();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    const script = document.createElement('script');
    script.async = true;
    script.charset = 'utf-8';
    script.src = `${TP_CONTENT_SRC}?${new URLSearchParams({ ...WIDGET_PARAMS, ...themeParams() }).toString()}`;
    host.appendChild(script);
    return () => host.replaceChildren();
  }, [theme]);

  return <div ref={hostRef} className={styles.esimWidget} />;
}
