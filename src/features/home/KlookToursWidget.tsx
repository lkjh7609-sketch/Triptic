import { useEffect, useRef } from 'react';
import { aiLocale } from '@/shared/api/aiCacheKeys';
import styles from './SectionScreen.module.css';

/**
 * Klook 투어 위젯(Travelpayouts "Specific City/Category Tours Widget", promo 4497).
 * 임베드 스크립트는 자기 src의 city_id로 Klook <ins>를 만들고 Klook 로더가 iframe으로
 * 그린다 — 그래서 도시가 바뀌거나 화면에 다시 들어올 때마다 컨테이너를 비우고 새 도시
 * 번호로 스크립트를 새로 넣으면 된다(추천 링크 shmarker는 그대로 붙는다).
 */
const TP_CONTENT_SRC = 'https://tpembd.com/content';
const WIDGET_PARAMS = {
  trs: '578749',
  shmarker: '782766.Hom_Widget',
  category: '2', // Tours & Sightseeing
  amount: '3',
  powered_by: 'true',
  campaign_id: '137',
  promo_id: '4497',
};

export function KlookToursWidget({ cityId, locale, currency = 'KRW' }: { cityId: number; locale: string; currency?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.replaceChildren();
    const params = new URLSearchParams({ currency, ...WIDGET_PARAMS, locale: aiLocale(locale), city_id: String(cityId) });
    const script = document.createElement('script');
    script.async = true;
    script.charset = 'utf-8';
    script.src = `${TP_CONTENT_SRC}?${params.toString()}`;
    host.appendChild(script);
    return () => host.replaceChildren();
  }, [cityId, locale, currency]);

  return <div ref={hostRef} className={styles.toursWidget} />;
}
