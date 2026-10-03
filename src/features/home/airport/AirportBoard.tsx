import { ChevronLeft, ChevronRight, PlaneLanding, PlaneTakeoff } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import shared from '../stitch/shared.module.css';
import {
  buildPages,
  DEPARTURE_LEAD_MIN,
  delayMinutes,
  pageItems,
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

const PAGE = 8;
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

/**
 * 홈 '인천공항 출·도착' 전광판 — 공항 전광판처럼 지금 이후 편을 시각 순으로. 출발/도착 탭, 줄을 누르면 상세.
 * 데이터는 Edge Function(incheon-board)이 3분마다 한 번만 외부에서 받아 둔 값이다. 받아 온 값이 없으면 섹션을 그리지 않는다.
 */
export function AirportBoard({ desktop }: { desktop: boolean }) {
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

  const rows = useMemo(
    () => visibleFlights(data?.[direction] ?? [], nowMin),
    [data, direction, nowMin],
  );

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
  if (!data || !fetchedAt) return null;

  const TabIcon = direction === 'departures' ? PlaneTakeoff : PlaneLanding;
  const departures = direction === 'departures';
  // 출발은 지금 +40분 편이 있는 쪽에서 시작하고(앞쪽으로 넘기면 탑승중·방금 출발한 편), 도착은 맨 앞에서 시작
  const { pages, initial } = buildPages(
    rows,
    departures ? startOffset(rows, nowMin, DEPARTURE_LEAD_MIN, PAGE) : 0,
    PAGE,
  );
  const current = Math.min(manualPage ?? initial, pages.length - 1);
  const shown = pages[current];

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
          <p className={shared.sub}>{t('airport.updated', { time: updatedLabel })}</p>
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

        {shown.length === 0 ? (
          <p className={styles.empty}>
            {t(departures ? 'airport.emptyDepartures' : 'airport.emptyArrivals')}
          </p>
        ) : (
          <ul className={styles.list}>
            {shown.map((flight) => {
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
                <li key={flight.id}>
                  <button
                    type="button"
                    className={`${styles.row} ${done ? styles.rowDone : ''}`}
                    onClick={() => setSelected({ flight, direction })}
                    aria-haspopup="dialog"
                  >
                    <span className={styles.time}>
                      <span className={late ? styles.timeOld : styles.timeMain}>
                        {formatHhmm(shownTime)}
                      </span>
                      {late ? (
                        <span className={styles.timeNew}>{formatHhmm(flight.estimated)}</span>
                      ) : null}
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
                    {desktop ? (
                      <ChevronRight size={18} aria-hidden="true" className={styles.chevron} />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {pages.length > 1 ? (
          <nav className={styles.pager} aria-label={t('airport.pager.label')}>
            <button
              type="button"
              className={styles.pageArrow}
              disabled={current === 0}
              onClick={() => setManualPage(current - 1)}
              aria-label={t('airport.pager.prev')}
            >
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            {pageItems(current, pages.length).map((item, i) =>
              item === '…' ? (
                <span key={`gap-${i}`} className={styles.pageGap} aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={item === current + 1 ? styles.pageOn : styles.page}
                  aria-current={item === current + 1 ? 'page' : undefined}
                  aria-label={t('airport.pager.goTo', { page: item })}
                  onClick={() => setManualPage(item - 1)}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              className={styles.pageArrow}
              disabled={current === pages.length - 1}
              onClick={() => setManualPage(current + 1)}
              aria-label={t('airport.pager.next')}
            >
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </nav>
        ) : null}
        <p className={styles.source}>{t('airport.source')}</p>
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
