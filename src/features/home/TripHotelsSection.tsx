import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { TRIP_CARD_SIZE, TRIP_HOTEL_CARDS, TRIP_HOTEL_WIDGET, TRIP_WIDGET_SIZE, tripAdSrc } from './tripPartner';
import styles from './TripHotelsSection.module.css';

/** 칸 폭에 맞춘 배율(1 이하) — 위젯은 픽셀 크기가 정해진 iframe이라 좁은 화면에서는 CSS로 줄인다 */
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

/**
 * 호텔 화면 — 트립닷컴 검색 위젯(세로형) + 추천 호텔 배너 3개 + "Powered by Trip.com".
 * PC: 위젯 왼쪽, 배너 3개를 오른쪽에 세로로 쌓되 위젯 높이(645px)에 딱 맞게 82%로 줄인다(245×204 ×3 + 간격).
 * 좁은 화면: 위젯(칸 폭에 맞춰 줄임) 아래에 배너를 원래 크기로 가로로 넘겨 본다.
 * 전부 트립닷컴 iframe이라 화면을 열 때 트립닷컴에서 불러온다. sandbox는 걸지 않는다(걸면 예약 화면을 못 연다).
 */
export function TripHotelsSection() {
  const { t, i18n } = useTranslation('home');
  const widgetRef = useRef<HTMLDivElement>(null);
  const scale = useFitScale(widgetRef);

  return (
    <section className={styles.section}>
      <div className={styles.layout}>
        <div ref={widgetRef} className={styles.widget} style={{ height: TRIP_WIDGET_SIZE.height * scale }}>
          <iframe
            className={styles.iframe}
            src={tripAdSrc(TRIP_HOTEL_WIDGET, i18n.language)}
            title={t('hotels.widgetTitle')}
            width={TRIP_WIDGET_SIZE.width}
            height={TRIP_WIDGET_SIZE.height}
            frameBorder="0"
            scrolling="no"
            style={scale < 1 ? { transform: `scale(${scale})` } : undefined}
          />
        </div>

        <div className={styles.cards} role="group" aria-label={t('hotels.cards.label')}>
          {TRIP_HOTEL_CARDS.map((card, i) => (
            <div key={card.code} className={styles.card}>
              <iframe
                className={`${styles.iframe} ${styles.cardFrame}`}
                src={tripAdSrc(card, i18n.language)}
                title={t('hotels.cards.title', { n: i + 1 })}
                width={TRIP_CARD_SIZE.width}
                height={TRIP_CARD_SIZE.height}
                frameBorder="0"
                scrolling="no"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
      <p className={styles.powered}>
        Powered by <span className={styles.wordmark}>Trip.com</span>
      </p>
    </section>
  );
}
