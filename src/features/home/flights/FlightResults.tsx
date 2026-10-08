import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, PlaneTakeoff, RefreshCw, TriangleAlert } from 'lucide-react';
import { showToast } from '@/shared/ui/toast';
import { airlineDisplayName } from '@/features/plan/flightLookup/airlineNames';
import type { FlightSearch } from '@/features/plan/partnerLinks';
import { formatMoney, type FlightLeg, type FlightOffer } from './flightsApi';
import { useFlightResults } from './useFlightResults';
import styles from './FlightResults.module.css';

type Sort = 'price' | 'duration' | 'depart';
type StopsFilter = 'any' | '0' | '1';
const SORTS: Sort[] = ['price', 'duration', 'depart'];

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

function OfferCard({ offer, bookingUrl, language, payers }: { offer: FlightOffer; bookingUrl: string; language: string; payers: number }) {
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
        <span className={styles.perPerson}>{t('flights.results.perPerson')}</span>
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
  const [airline, setAirline] = useState<string | null>(null);
  const payers = search.adults + (search.children ?? 0);

  const airlines = useMemo(() => {
    const seen = new Map<string, { name: string; min: number }>();
    for (const o of data?.offers ?? []) {
      const l = o.legs[0];
      const prev = seen.get(l.carrier.code);
      if (!prev || o.price < prev.min) seen.set(l.carrier.code, { name: l.carrier.name, min: o.price });
    }
    return [...seen.entries()].sort((a, b) => a[1].min - b[1].min).slice(0, 8);
  }, [data]);

  const offers = useMemo(() => {
    const list = (data?.offers ?? []).filter(
      (o) =>
        (stops === 'any' || o.legs.every((l) => l.stops <= Number(stops))) && (!airline || o.legs[0].carrier.code === airline),
    );
    const by: Record<Sort, (a: FlightOffer, b: FlightOffer) => number> = {
      price: (a, b) => a.price - b.price,
      duration: (a, b) => totalMinutes(a) - totalMinutes(b) || a.price - b.price,
      depart: (a, b) => a.legs[0].depart.localeCompare(b.legs[0].depart) || a.price - b.price,
    };
    return [...list].sort(by[sort]);
  }, [data, sort, stops, airline]);

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
            <div className={styles.segment} role="group" aria-label={t('flights.results.sortLabel')}>
              {SORTS.map((s) => (
                <button key={s} type="button" aria-pressed={sort === s} className={sort === s ? styles.segOn : styles.segOff} onClick={() => setSort(s)}>
                  {t(`flights.results.sort.${s}`)}
                </button>
              ))}
            </div>
            <div className={styles.chips} role="group" aria-label={t('flights.results.stopsLabel')}>
              {(['any', '0', '1'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={stops === v} className={stops === v ? styles.chipOn : styles.chip} onClick={() => setStops(v)}>
                  {t(`flights.results.stops.${v}`)}
                </button>
              ))}
            </div>
          </div>
          {airlines.length > 1 ? (
            <div className={styles.chips} role="group" aria-label={t('flights.results.airlineLabel')}>
              <button type="button" aria-pressed={!airline} className={!airline ? styles.chipOn : styles.chip} onClick={() => setAirline(null)}>
                {t('flights.results.allAirlines')}
              </button>
              {airlines.map(([code, a]) => (
                <button key={code} type="button" aria-pressed={airline === code} className={airline === code ? styles.chipOn : styles.chip} onClick={() => setAirline(airline === code ? null : code)}>
                  {airlineDisplayName(code, i18n.language.startsWith('ko') ? 'ko' : i18n.language, a.name) || a.name}
                </button>
              ))}
            </div>
          ) : null}
          {offers.length > 0 ? (
            <ul className={styles.list}>
              {offers.map((o) => (
                <OfferCard key={o.id} offer={o} bookingUrl={data.bookingUrl} language={i18n.language} payers={payers} />
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>{t('flights.results.emptyFiltered')}</p>
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
