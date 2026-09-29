import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { TRIP_WIDGET_SIZE, tripWidgetSrc } from './tripPartner';
import styles from './TripHotelsWidget.module.css';

/** 칸 폭에 맞춘 배율(1 이하) — 위젯은 픽셀 크기가 정해진 iframe이라 좁은 창에서는 CSS로 줄인다 */
function useFitScale(ref: RefObject<HTMLDivElement | null>): number {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // jsdom처럼 폭을 못 재면(0) 줄이지 않는다
    const update = () => setScale(Math.min(1, el.clientWidth / TRIP_WIDGET_SIZE.width) || 1);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

/** 호텔 화면의 트립닷컴 검색창 위젯 — 표시 언어에 맞는 주소로 뜬다(tripPartner.ts) */
export function TripHotelsWidget() {
  const { t, i18n } = useTranslation('home');
  const frameRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(frameRef);

  return (
    <div ref={frameRef} className={styles.frame} style={{ height: TRIP_WIDGET_SIZE.height * scale }}>
      <iframe
        className={styles.iframe}
        src={tripWidgetSrc(i18n.language)}
        title={t('hotels.widgetTitle')}
        width={TRIP_WIDGET_SIZE.width}
        height={TRIP_WIDGET_SIZE.height}
        frameBorder="0"
        scrolling="no"
        loading="lazy"
        style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
      />
    </div>
  );
}
