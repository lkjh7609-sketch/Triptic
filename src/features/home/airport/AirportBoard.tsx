import { ChevronLeft, ChevronRight, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import shared from '../stitch/shared.module.css';
import {
  buildPages,
  DEPARTURE_LEAD_MIN,
  delayMinutes,
  dotWindow,
  startOffset,
  formatHhmm,
  statusInfo,
  terminalLabel,
  visibleFlights,
  type BoardDirection,
  type BoardFlight,
} from './boardParse';
import { FlightDetailDialog } from './FlightDetailDialog';
import { useAirportBoard, useKstMinutes, useNowMs } from './useAirportBoard';
import styles from './AirportBoard.module.css';

const PAGE = 5;
/** 마지막으로 받은 지 이만큼(분)이 넘으면 "갱신 못 함" 안내를 보여 준다 */
const STALE_NOTICE_MIN = 15;

export function StatusChip({ remark }: { remark: string }) {
  const { t } = useTranslation('home');
  const info = statusInfo(remark);
  if (!remark) return null;
  return (
    <span className={`${styles.chip} ${styles[`tone_${info?.tone ?? 'neutral'}`]}`}>
      {info ? t(`airport.status.${info.key}`) : remark}
    </span>
  );
}

/** 목적지/출발지 — 한국어는 이름을 크게, 그 밖의 언어는 공항 코드를 크게(이름은 한국어로만 받아 와서 작게) */
export function CityLabel({ flight, korean }: { flight: BoardFlight; korean: boolean }) {
  const main = korean ? flight.city || flight.airportCode : flight.airportCode || flight.city;
  const sub = korean ? flight.airportCode : flight.city;
  return (
    <span className={styles.cityBlock}>
      <span className={styles.city}>{main}</span>
      {sub && sub !== main ? <span className={styles.sub}>{sub}</span> : null}
    </span>
  );
}

/** 전광판 한 줄 — 눌러서 상세를 연다 */
function BoardRow({
  flight,
  departures,
  desktop,
  korean,
  onOpen,
}: {
  flight: BoardFlight;
  departures: boolean;
  desktop: boolean;
  korean: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation('home');
  const late = delayMinutes(flight) > 0;
  // 앞당겨진 편(이미 떠난 편의 실제 시각 등)은 바뀐 시각만 보여 준다
  const shownTime = late
    ? flight.scheduled
    : delayMinutes(flight) < 0
      ? flight.estimated
      : flight.scheduled;
  const done = statusInfo(flight.remark)?.tone === 'done';
  const terminal = terminalLabel(flight.terminal);
  const place = departures ? flight.gate : flight.carousel;
  return (
    <button
      type="button"
      className={`${styles.row} ${done ? styles.rowDone : ''}`}
      onClick={onOpen}
      aria-haspopup="dialog"
    >
      <span className={styles.time}>
        <span className={late ? styles.timeOld : styles.timeMain}>{formatHhmm(shownTime)}</span>
        {late ? <span className={styles.timeNew}>{formatHhmm(flight.estimated)}</span> : null}
      </span>
      <span className={styles.flightBlock}>
        <span className={styles.flightId}>{flight.id}</span>
        <span className={styles.sub}>
          {flight.airline}
          {flight.codeshares.length > 0
            ? ` · ${t('airport.codeshareN', { count: flight.codeshares.length })}`
            : ''}
        </span>
      </span>
      <CityLabel flight={flight} korean={korean} />
      {desktop ? (
        <>
          <span className={styles.terminal}>
            {terminal.key ? t(`airport.terminal.${terminal.key}`) : terminal.raw}
          </span>
          <span className={styles.gate}>{place || '–'}</span>
        </>
      ) : null}
      <span className={styles.statusCell}>
        <StatusChip remark={flight.remark} />
        {!desktop ? (
          <span className={styles.sub}>
            {terminal.key ? t(`airport.terminalShort.${terminal.key}`) : terminal.raw}
            {place ? ` · ${place}` : ''}
          </span>
        ) : null}
      </span>
      {desktop ? <ChevronRight size={18} aria-hidden="true" className={styles.chevron} /> : null}
    </button>
  );
}

/**
 * '인천공항 출·도착' 전광판(공항 화면, standalone) — 공항 전광판처럼 지금 이후 편을 시각 순으로. 출발/도착 탭, 줄을 누르면 상세.
 * 데이터는 Edge Function(incheon-board)이 3분마다 한 번만 외부에서 받아 둔 값이다. 받아 온 값이 없으면 섹션을 그리지 않는다.
 */
export function AirportBoard({ desktop, standalone = false }: { desktop: boolean; standalone?: boolean }) {
  const { t, i18n } = useTranslation('home');
  const { data, isLoading } = useAirportBoard();
  const nowMin = useKstMinutes();
  const nowMs = useNowMs();
  const [direction, setDirection] = useState<BoardDirection>('departures');
  // 사용자가 직접 넘긴 쪽(없으면 처음 쪽 = 출발은 지금+40분 편이 있는 쪽)
  const [manualPage, setManualPage] = useState<number | null>(null);
  const [selected, setSelected] = useState<{
    flight: BoardFlight;
    direction: BoardDirection;
  } | null>(null);
  const korean = i18n.language.startsWith('ko');
  const trackRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef(0);

  const rows = useMemo(
    () => visibleFlights(data?.[direction] ?? [], nowMin),
    [data, direction, nowMin],
  );

  // 출발은 지금 +40분 편이 있는 쪽에서 시작하고(앞쪽으로 넘기면 탑승중·방금 출발한 편), 도착은 맨 앞에서 시작
  const departures = direction === 'departures';
  const { pages, initial } = buildPages(
    rows,
    departures ? startOffset(rows, nowMin, DEPARTURE_LEAD_MIN, PAGE) : 0,
    PAGE,
  );
  const current = Math.min(manualPage ?? initial, pages.length - 1);

  useLayoutEffect(() => {
    currentRef.current = current;
  });
  // 줄이 새로 그려질 때(처음·탭 바꿈) 현재 쪽 자리로 바로 가 있는다
  const hasRows = rows.length > 0;
  const hasData = data !== undefined;
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (el) el.scrollLeft = currentRef.current * el.clientWidth;
  }, [direction, hasRows, hasData]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== current && index >= 0 && index < pages.length) setManualPage(index);
  }

  function goTo(index: number) {
    const next = Math.min(Math.max(0, index), pages.length - 1);
    setManualPage(next);
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const el = trackRef.current;
    el?.scrollTo?.({ left: next * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' });
  }

  const dots = dotWindow(current, pages.length);

  const fetchedAt = data?.fetchedAt ? new Date(data.fetchedAt) : null;
  const ageMin = fetchedAt ? (nowMs - fetchedAt.getTime()) / 60_000 : Infinity;
  const updatedLabel = fetchedAt
    ? new Intl.DateTimeFormat(i18n.language, {
        timeZone: 'Asia/Seoul',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(fetchedAt)
    : '';

  // 아직 받는 중이거나 한 번도 받은 적이 없으면 섹션을 그리지 않는다(홈에 빈 틀을 남기지 않는다)
  if (isLoading)
    return (
      <section className={shared.section} aria-hidden="true">
        <div className={styles.skeleton} />
      </section>
    );
  if (!data || !fetchedAt)
    // 홈의 한 섹션일 땐 빈 틀을 남기지 않지만, 공항 화면 안에서는 비어 보이지 않게 안내를 둔다
    return standalone ? (
      <section className={shared.section} aria-labelledby="home-airport-title">
        <h2 id="home-airport-title" className={shared.title}>
          {t('airport.title')}
        </h2>
        <p className={styles.empty}>{t('airport.unavailable')}</p>
      </section>
    ) : null;

  const TabIcon = direction === 'departures' ? PlaneTakeoff : PlaneLanding;

  return (
    <section className={shared.section} aria-labelledby="home-airport-title">
      <div className={`${shared.head} ${styles.head}`}>
        <div className={shared.headText}>
          <div className={styles.titleRow}>
            <TabIcon size={desktop ? 22 : 20} aria-hidden="true" className={styles.titleIcon} />
            <h2 id="home-airport-title" className={shared.title}>
              {t('airport.title')}
            </h2>
            <span className={styles.live} aria-hidden="true" />
          </div>
          <p className={shared.sub}>
            {t('airport.updated', { time: updatedLabel })} · {t('airport.source')}
          </p>
        </div>
        <div className={styles.tabs} role="group" aria-label={t('airport.tabsLabel')}>
          {(['departures', 'arrivals'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={direction === key ? styles.tabOn : styles.tab}
              aria-pressed={direction === key}
              onClick={() => {
                setDirection(key);
                setManualPage(null);
              }}
            >
              {t(`airport.${key}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.board}>
        {ageMin > STALE_NOTICE_MIN ? (
          <p className={styles.notice}>{t('airport.staleNotice', { time: updatedLabel })}</p>
        ) : null}

        {desktop ? (
          <div className={styles.colHead} aria-hidden="true">
            <span>{t('airport.col.time')}</span>
            <span>{t('airport.col.flight')}</span>
            <span>{t(departures ? 'airport.col.to' : 'airport.col.from')}</span>
            <span>{t('airport.col.terminal')}</span>
            <span>{t(departures ? 'airport.col.gate' : 'airport.col.carousel')}</span>
            <span>{t('airport.col.status')}</span>
            <span />
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className={styles.empty}>
            {t(departures ? 'airport.emptyDepartures' : 'airport.emptyArrivals')}
          </p>
        ) : (
          <div className={styles.stage}>
            {/* 쪽마다 한 장씩 가로로 놓고 손가락으로 밀어 넘긴다(scroll-snap). PC는 양옆 화살표 */}
            <div key={direction} ref={trackRef} className={styles.track} onScroll={handleScroll}>
              {pages.map((page, i) => (
                <ul
                  key={i}
                  className={styles.slide}
                  inert={i !== current}
                  aria-hidden={i !== current}
                >
                  {page.map((flight) => (
                    <li key={flight.id}>
                      <BoardRow
                        flight={flight}
                        departures={departures}
                        desktop={desktop}
                        korean={korean}
                        onOpen={() => setSelected({ flight, direction })}
                      />
                    </li>
                  ))}
                </ul>
              ))}
            </div>
            {desktop && pages.length > 1 ? (
              <>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.arrowPrev}`}
                  disabled={current === 0}
                  onClick={() => goTo(current - 1)}
                  aria-label={t('airport.pager.prev')}
                >
                  <ChevronLeft size={22} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`${styles.arrow} ${styles.arrowNext}`}
                  disabled={current === pages.length - 1}
                  onClick={() => goTo(current + 1)}
                  aria-label={t('airport.pager.next')}
                >
                  <ChevronRight size={22} aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
        )}

        {pages.length > 1 ? (
          <div className={styles.dots} role="group" aria-label={t('airport.pager.label')}>
            {Array.from({ length: dots.count }, (_, k) => {
              const index = dots.start + k;
              const edge = (k === 0 && dots.before) || (k === dots.count - 1 && dots.after);
              return (
                <button
                  key={index}
                  type="button"
                  className={styles.dotHit}
                  aria-label={t('airport.pager.goTo', { page: index + 1 })}
                  aria-current={index === current ? 'true' : undefined}
                  onClick={() => goTo(index)}
                >
                  <span
                    className={`${styles.dot} ${index === current ? styles.dotOn : ''} ${edge ? styles.dotEdge : ''}`}
                  />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {selected ? (
        <FlightDetailDialog
          flight={selected.flight}
          direction={selected.direction}
          korean={korean}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}
