import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, PlaneTakeoff, RefreshCw, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import { showToast } from '@/shared/ui/toast';
import { airlineDisplayName } from '@/features/plan/flightLookup/airlineNames';
import type { FlightSearch } from '@/features/plan/partnerLinks';
import { formatMoney, type FlightLeg, type FlightOffer } from './flightsApi';
import { useFlightResults } from './useFlightResults';
import styles from './FlightResults.module.css';

type Sort = 'price' | 'duration' | 'depart';
type StopsFilter = 'any' | '0' | '1';
type TimeBucket = 'dawn' | 'morning' | 'afternoon' | 'evening';
const SORTS: Sort[] = ['price', 'duration', 'depart'];
const TIMES: TimeBucket[] = ['dawn', 'morning', 'afternoon', 'evening'];

/** 가는 편 출발 시각(현지) → 시간대: 새벽 0–6 · 오전 6–12 · 오후 12–18 · 저녁 18–24 */
function timeBucket(iso: string): TimeBucket {
  const h = Number(iso.slice(11, 13));
  return h < 6 ? 'dawn' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

/** 예약 사이트로 나가는 링크 속성 — 제휴 링크라 sponsored */
const EXTERNAL = { target: '_blank', rel: 'sponsored nofollow noopener noreferrer' } as const;

const hhmm = (iso: string) => iso.slice(11, 16);
const totalMinutes = (o: FlightOffer) => o.legs.reduce((sum, l) => sum + l.minutes, 0);

/** 항공사 로고 — 이미지가 안 오면 코드 두 글자 배지로 */
function AirlineLogo({ code }: { code: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={styles.logoFallback} aria-hidden="true">{code}</span>;
  return <img src={`https://pics.avs.io/56/56/${code}.png`} alt="" className={styles.logo} width={28} height={28} loading="lazy" onError={() => setFailed(true)} />;
}

function Duration({ minutes }: { minutes: number }) {
  const { t } = useTranslation('home');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return <>{h > 0 ? t('flights.results.durationHM', { h, m }) : t('flights.results.durationM', { m })}</>;
}

function Leg({ leg, language }: { leg: FlightLeg; language: string }) {
  const { t } = useTranslation('home');
  const name = airlineDisplayName(leg.carrier.code, language.startsWith('ko') ? 'ko' : language, leg.carrier.name) || leg.carrier.name;
  const dayShift = leg.arrive.slice(0, 10) > leg.depart.slice(0, 10);
  const date = new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(`${leg.depart.slice(0, 10)}T00:00:00`));
  return (
    <div className={styles.leg}>
      <div className={styles.airline}>
        <AirlineLogo code={leg.carrier.code} />
        <span className={styles.airlineName}>{name}</span>
        <span className={styles.legDate}>{date}</span>
      </div>
      <div className={styles.times}>
        <div className={styles.point}>
          <span className={styles.time}>{hhmm(leg.depart)}</span>
          <span className={styles.code}>{leg.origin}</span>
        </div>
        <div className={styles.line} aria-hidden="true">
          <span className={styles.duration}>
            <Duration minutes={leg.minutes} />
          </span>
          <span className={styles.rail} />
          <span className={leg.stops === 0 ? styles.stopsDirect : styles.stops}>
            {leg.stops === 0 ? t('flights.results.direct') : t('flights.results.stopsN', { count: leg.stops })}
            {leg.via.length > 0 ? ` · ${leg.via.join(', ')}` : ''}
          </span>
        </div>
        <div className={styles.point}>
          <span className={styles.time}>
            {hhmm(leg.arrive)}
            {dayShift ? <sup className={styles.dayShift}>+1</sup> : null}
          </span>
          <span className={styles.code}>{leg.destination}</span>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, bookingUrl, language, payers, mixed }: { offer: FlightOffer; bookingUrl: string; language: string; payers: number; mixed: boolean }) {
  const { t } = useTranslation('home');
  const direct = offer.legs.every((l) => l.stops === 0);
  return (
    <li className={styles.card}>
      <div className={styles.legs}>
        {offer.legs.map((leg, i) => (
          <Leg key={i} leg={leg} language={language} />
        ))}
        <div className={styles.badges}>
          {direct ? <span className={styles.badgeGood}>{t('flights.results.direct')}</span> : null}
          {offer.selfTransfer ? (
            <span className={styles.badgeWarn}>
              <TriangleAlert size={12} aria-hidden="true" /> {t('flights.results.selfTransfer')}
            </span>
          ) : null}
        </div>
      </div>
      <div className={styles.buy}>
        <span className={styles.price}>
          {!offer.verified ? <span className={styles.approx}>{t('flights.results.approx')} </span> : null}
          {formatMoney(offer.perPerson, offer.currency, language)}
        </span>
        <span className={styles.perPerson}>{t(mixed ? 'flights.results.perPersonAvg' : 'flights.results.perPerson')}</span>
        {payers > 1 ? <span className={styles.total}>{t('flights.results.total', { price: formatMoney(offer.price, offer.currency, language) })}</span> : null}
        <a className={styles.book} href={bookingUrl} {...EXTERNAL} onClick={() => showToast(t('flights.results.redirecting'))}>
          {t('flights.results.book')} <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

function SkeletonCards() {
  return (
    <ul className={styles.list} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className={`${styles.card} ${styles.skeleton}`} />
      ))}
    </ul>
  );
}

/**
 * 항공 검색 결과. 목록·정렬·필터는 우리 화면 안에서(받은 결과를 거른다), 예약은 예약 사이트(새 탭) —
 * 예약 링크는 노선·날짜·인원만 넘기므로 카드의 그 항공편이 예약 사이트에 없을 수도 있다(아래 안내 문구).
 */
export function FlightResults({ search }: { search: FlightSearch }) {
  const { t, i18n } = useTranslation('home');
  const { data, loading, error, fallbackUrl } = useFlightResults(search, i18n.language);
  const [sort, setSort] = useState<Sort>('price');
  const [stops, setStops] = useState<StopsFilter>('any');
  const [airlineSel, setAirlineSel] = useState<string[]>([]);
  const [timeSel, setTimeSel] = useState<TimeBucket[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const payers = search.adults + (search.children ?? 0);
  const filterCount = (stops !== 'any' ? 1 : 0) + airlineSel.length + timeSel.length;
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const resetFilters = () => {
    setStops('any');
    setAirlineSel([]);
    setTimeSel([]);
  };
  const lang = i18n.language.startsWith('ko') ? 'ko' : i18n.language;

  const airlines = useMemo(() => {
    const seen = new Map<string, { name: string; min: number }>();
    for (const o of data?.offers ?? []) {
      const l = o.legs[0];
      const prev = seen.get(l.carrier.code);
      if (!prev || o.price < prev.min) seen.set(l.carrier.code, { name: l.carrier.name, min: o.price });
    }
    return [...seen.entries()].sort((a, b) => a[1].min - b[1].min).slice(0, 12);
  }, [data]);

  const offers = useMemo(() => {
    const list = (data?.offers ?? []).filter(
      (o) =>
        (stops === 'any' || o.legs.every((l) => l.stops <= Number(stops))) &&
        (airlineSel.length === 0 || airlineSel.includes(o.legs[0].carrier.code)) &&
        (timeSel.length === 0 || timeSel.includes(timeBucket(o.legs[0].depart))),
    );
    const by: Record<Sort, (a: FlightOffer, b: FlightOffer) => number> = {
      price: (a, b) => a.price - b.price,
      duration: (a, b) => totalMinutes(a) - totalMinutes(b) || a.price - b.price,
      depart: (a, b) => a.legs[0].depart.localeCompare(b.legs[0].depart) || a.price - b.price,
    };
    return [...list].sort(by[sort]);
  }, [data, sort, stops, airlineSel, timeSel]);

  const airlineName = (code: string, name: string) => airlineDisplayName(code, lang, name) || name;
  /** 접힌 상태에서 보여 주는 지금 걸린 필터들(눌러서 해제) */
  const active: { key: string; label: string; clear: () => void }[] = [
    ...(stops !== 'any' ? [{ key: 'stops', label: t(`flights.results.stops.${stops}`), clear: () => setStops('any') }] : []),
    ...timeSel.map((b) => ({ key: `t-${b}`, label: t(`flights.results.time.${b}`), clear: () => setTimeSel((l) => l.filter((x) => x !== b)) })),
    ...airlineSel.map((c) => ({ key: `a-${c}`, label: airlineName(c, airlines.find(([code]) => code === c)?.[1].name ?? c), clear: () => setAirlineSel((l) => l.filter((x) => x !== c)) })),
  ];

  if (error) {
    return (
      <section className={styles.state} aria-live="polite">
        <PlaneTakeoff size={24} aria-hidden="true" />
        <h2 className={styles.stateTitle}>{t(error === 'unavailable' ? 'flights.results.unavailableTitle' : 'flights.results.failedTitle')}</h2>
        <p className={styles.stateBody}>{t(error === 'unavailable' ? 'flights.results.unavailableBody' : 'flights.results.failedBody')}</p>
        {fallbackUrl ? (
          <a className={styles.book} href={fallbackUrl} {...EXTERNAL} onClick={() => showToast(t('flights.results.redirecting'))}>
            {t('flights.results.searchOnSite')} <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </section>
    );
  }

  return (
    <section className={styles.wrap} aria-label={t('flights.results.label')} aria-busy={loading}>
      {loading ? (
        <>
          <p className={styles.progress} role="status">
            <RefreshCw size={14} aria-hidden="true" className={styles.spin} /> {t('flights.results.searching')}
          </p>
          <SkeletonCards />
        </>
      ) : null}

      {data && data.offers.length > 0 ? (
        <>
          <div className={styles.toolbar}>
            <span className={styles.count} aria-live="polite">
              {t('flights.results.count', { count: offers.length })}
            </span>
            <div className={styles.toolbarRight}>
              <label className={styles.sortSelect}>
                <span className={styles.srOnly}>{t('flights.results.sortLabel')}</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                  {SORTS.map((s) => (
                    <option key={s} value={s}>
                      {t(`flights.results.sort.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className={filterCount > 0 ? styles.filterBtnOn : styles.filterBtn} aria-expanded={filtersOpen} aria-controls="flight-filters" onClick={() => setFiltersOpen((o) => !o)}>
                <SlidersHorizontal size={16} aria-hidden="true" /> {t('flights.results.filter')}
                {filterCount > 0 ? <span className={styles.filterBadge}>{filterCount}</span> : null}
              </button>
            </div>
          </div>
          {filtersOpen ? (
            <div id="flight-filters" className={styles.panel}>
              <div className={styles.panelSection} role="group" aria-label={t('flights.results.stopsLabel')}>
                <span className={styles.panelTitle}>{t('flights.results.stopsLabel')}</span>
                <div className={styles.panelChips}>
                  {(['any', '0', '1'] as const).map((v) => (
                    <button key={v} type="button" aria-pressed={stops === v} className={stops === v ? styles.chipOn : styles.chip} onClick={() => setStops(v)}>
                      {t(`flights.results.stops.${v}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.panelSection} role="group" aria-label={t('flights.results.timeLabel')}>
                <span className={styles.panelTitle}>{t('flights.results.timeLabel')}</span>
                <div className={styles.panelChips}>
                  {TIMES.map((b) => (
                    <button key={b} type="button" aria-pressed={timeSel.includes(b)} className={timeSel.includes(b) ? styles.chipOn : styles.chip} onClick={() => setTimeSel((l) => toggle(l, b))}>
                      {t(`flights.results.time.${b}`)}
                    </button>
                  ))}
                </div>
              </div>
              {airlines.length > 1 ? (
                <div className={styles.panelSection} role="group" aria-label={t('flights.results.airlineLabel')}>
                  <span className={styles.panelTitle}>{t('flights.results.airlineLabel')}</span>
                  <div className={styles.panelChips}>
                    {airlines.map(([code, a]) => (
                      <button key={code} type="button" aria-pressed={airlineSel.includes(code)} className={airlineSel.includes(code) ? styles.chipOn : styles.chip} onClick={() => setAirlineSel((l) => toggle(l, code))}>
                        {airlineName(code, a.name)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={styles.panelFooter}>
                <button type="button" className={styles.resetBtn} disabled={filterCount === 0} onClick={resetFilters}>
                  {t('flights.results.filterReset')}
                </button>
                <button type="button" className={styles.doneBtn} onClick={() => setFiltersOpen(false)}>
                  {t('flights.results.filterDone')}
                </button>
              </div>
            </div>
          ) : active.length > 0 ? (
            <div className={styles.activeChips}>
              {active.map((a) => (
                <button key={a.key} type="button" className={styles.activeChip} aria-label={t('flights.results.removeFilter', { name: a.label })} onClick={a.clear}>
                  {a.label} <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}
          {offers.length > 0 ? (
            <ul className={styles.list}>
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} bookingUrl={data.bookingUrl} language={i18n.language} payers={payers} mixed={(search.children ?? 0) > 0 || (search.infants ?? 0) > 0} />
              ))}
            </ul>
          ) : (
            <div className={styles.emptyBox}>
              <p className={styles.empty}>{t('flights.results.emptyFiltered')}</p>
              <button type="button" className={styles.linkBtn} onClick={resetFilters}>
                {t('flights.results.filterReset')}
              </button>
            </div>
          )}
          <p className={styles.note}>{t('flights.results.priceNote')}</p>
        </>
      ) : null}

      {data && data.offers.length === 0 ? (
        <div className={styles.emptyBox}>
          <p className={styles.empty}>{t('flights.results.empty')}</p>
          <a className={styles.linkBtn} href={data.bookingUrl} {...EXTERNAL} onClick={() => showToast(t('flights.results.redirecting'))}>
            {t('flights.results.searchOnSite')} <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      ) : null}
    </section>
  );
}
