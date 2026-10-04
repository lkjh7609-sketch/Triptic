import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ExternalLink, Luggage, PlaneTakeoff, RefreshCw, ShieldCheck } from 'lucide-react';
import { useProfile } from '@/shared/hooks/useProfile';
import { EXTERNAL_LINK_PROPS, formatMoney, kayakCurrency, type FlightSort, type KayakFlightLeg, type KayakFlightOffer } from '@/features/kayak/kayakApi';
import { useFlightResults } from '@/features/kayak/useFlightResults';
import type { FlightSearch } from '@/features/plan/partnerLinks';
import styles from './KayakFlightResults.module.css';

const SORTS: FlightSort[] = ['best', 'price', 'duration'];
type StopsFilter = 'any' | '0' | '1';
const hhmm = (iso: string) => iso.slice(11, 16);

function Duration({ minutes }: { minutes: number }) {
  const { t } = useTranslation('home');
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return <>{h > 0 ? t('flights.kayak.durationHM', { h, m }) : t('flights.kayak.durationM', { m })}</>;
}

function Leg({ leg, places, language }: { leg: KayakFlightLeg; places: Record<string, string>; language: string }) {
  const { t } = useTranslation('home');
  const airlines = [...new Map(leg.segments.map((s) => [s.airline, s])).values()];
  const dayShift = leg.arrive.slice(0, 10) > leg.depart.slice(0, 10);
  const date = new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(`${leg.depart.slice(0, 10)}T00:00:00`));
  return (
    <div className={styles.leg}>
      <div className={styles.airline}>
        {airlines[0]?.airlineLogo ? <img src={airlines[0].airlineLogo} alt="" className={styles.logo} loading="lazy" width={28} height={28} /> : <PlaneTakeoff size={18} aria-hidden="true" />}
        <span className={styles.airlineName}>{airlines.map((a) => a.airlineName).join(' · ')}</span>
        <span className={styles.legDate}>{date}</span>
      </div>
      <div className={styles.times}>
        <div className={styles.point}>
          <span className={styles.time}>{hhmm(leg.depart)}</span>
          <span className={styles.code} title={places[leg.origin]}>{leg.origin}</span>
        </div>
        <div className={styles.line} aria-hidden="true">
          <span className={styles.duration}>
            <Duration minutes={leg.minutes} />
          </span>
          <span className={styles.rail} />
          <span className={leg.stops === 0 ? styles.stopsDirect : styles.stops}>
            {leg.stops === 0 ? t('flights.kayak.direct') : t('flights.kayak.stopsN', { count: leg.stops })}
            {leg.via.length > 0 ? ` · ${leg.via.join(', ')}` : ''}
          </span>
        </div>
        <div className={styles.point}>
          <span className={styles.time}>
            {hhmm(leg.arrive)}
            {dayShift ? <sup className={styles.dayShift}>+1</sup> : null}
          </span>
          <span className={styles.code} title={places[leg.destination]}>{leg.destination}</span>
        </div>
      </div>
    </div>
  );
}

function OfferCard({ offer, places, currency, language, travellers }: { offer: KayakFlightOffer; places: Record<string, string>; currency: string; language: string; travellers: number }) {
  const { t } = useTranslation('home');
  const [open, setOpen] = useState(false);
  const best = offer.options[0];
  const direct = offer.legs.every((l) => l.stops === 0);
  const bags = best.checked === 'included' ? t('flights.kayak.bagChecked') : best.carryOn === 'included' ? t('flights.kayak.bagCarryOn') : null;
  return (
    <li className={styles.card}>
      <div className={styles.legs}>
        {offer.legs.map((leg, i) => (
          <Leg key={i} leg={leg} places={places} language={language} />
        ))}
        <div className={styles.badges}>
          {direct ? <span className={styles.badgeGood}>{t('flights.kayak.direct')}</span> : null}
          {best.freeCancel ? (
            <span className={styles.badgeGood}>
              <ShieldCheck size={12} aria-hidden="true" /> {t('flights.kayak.freeCancel')}
            </span>
          ) : null}
          {bags ? (
            <span className={styles.badge}>
              <Luggage size={12} aria-hidden="true" /> {bags}
            </span>
          ) : null}
        </div>
      </div>
      <div className={styles.buy}>
        <span className={styles.price}>{formatMoney(offer.price, currency, language)}</span>
        <span className={styles.perPerson}>{travellers > 1 ? t('flights.kayak.perPerson') : t('flights.kayak.perPersonSolo')}</span>
        <a className={styles.book} href={best.bookingUrl} {...EXTERNAL_LINK_PROPS}>
          {t('flights.kayak.book')} <ExternalLink size={14} aria-hidden="true" />
        </a>
        <span className={styles.via}>{t('flights.kayak.via', { provider: best.providerName })}</span>
        {offer.options.length > 1 ? (
          <button type="button" className={styles.more} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {t('flights.kayak.otherSites', { count: offer.options.length - 1 })}
            <ChevronDown size={14} aria-hidden="true" className={open ? styles.chevOpen : undefined} />
          </button>
        ) : null}
      </div>
      {open ? (
        <ul className={styles.options}>
          {offer.options.slice(1).map((o) => (
            <li key={o.providerCode} className={styles.option}>
              <span className={styles.optionName}>{o.providerName}</span>
              <span className={styles.optionPrice}>{formatMoney(o.price, currency, language)}</span>
              <a className={styles.optionBook} href={o.bookingUrl} {...EXTERNAL_LINK_PROPS}>
                {t('flights.kayak.book')} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * 외국어 항공 탭의 검색 결과(Kayak). 목록은 우리 화면 안에 보여 주고, 예약은 Kayak 예약 링크(새 탭).
 * 정렬(추천·최저가·최단 시간)과 경유 조건은 Kayak이 처리하고, 항공사 거르기는 받은 결과 안에서 한다.
 */
export function KayakFlightResults({ search }: { search: FlightSearch }) {
  const { t, i18n } = useTranslation('home');
  const { data: profile } = useProfile();
  const currency = kayakCurrency(profile?.base_currency, i18n.language);
  const [sort, setSort] = useState<FlightSort>('best');
  const [stops, setStops] = useState<StopsFilter>('any');
  const [airlineFilter, setAirlineFilter] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      origin: search.origin,
      destination: search.destination,
      depart: search.departDate,
      return: search.returnDate,
      adults: search.adults,
      children: search.children ?? 0,
      infants: search.infants ?? 0,
      cabin: search.cabin ?? 'ECONOMY',
      currency,
    }),
    [search, currency],
  );
  const { data, loading, error } = useFlightResults(query, sort, stops === 'any' ? null : Number(stops));

  const airlines = useMemo(() => {
    const seen = new Map<string, { name: string; min: number }>();
    for (const o of data?.offers ?? []) {
      for (const s of o.legs.flatMap((l) => l.segments)) {
        const prev = seen.get(s.airline);
        if (!prev || o.price < prev.min) seen.set(s.airline, { name: s.airlineName, min: o.price });
      }
    }
    return [...seen.entries()].sort((a, b) => a[1].min - b[1].min).slice(0, 8);
  }, [data]);

  const offers = (data?.offers ?? []).filter((o) => !airlineFilter || o.legs.some((l) => l.segments.some((s) => s.airline === airlineFilter)));
  const travellers = search.adults + (search.children ?? 0) + (search.infants ?? 0);

  if (error === 'unavailable') {
    return (
      <section className={styles.state} aria-live="polite">
        <PlaneTakeoff size={24} aria-hidden="true" />
        <h2 className={styles.stateTitle}>{t('flights.comingSoon.title')}</h2>
        <p className={styles.stateBody}>{t('flights.comingSoon.body')}</p>
      </section>
    );
  }

  return (
    <section className={styles.wrap} aria-label={t('flights.kayak.results')} aria-busy={loading}>
      <div className={styles.toolbar}>
        <div className={styles.segment} role="group" aria-label={t('flights.kayak.sortLabel')}>
          {SORTS.map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} className={sort === s ? styles.segOn : styles.segOff} onClick={() => setSort(s)}>
              {t(`flights.kayak.sort.${s}`)}
            </button>
          ))}
        </div>
        <div className={styles.chips} role="group" aria-label={t('flights.kayak.stopsLabel')}>
          {(['any', '0', '1'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={stops === v} className={stops === v ? styles.chipOn : styles.chip} onClick={() => setStops(v)}>
              {t(`flights.kayak.stops.${v}`)}
            </button>
          ))}
        </div>
      </div>
      {airlines.length > 1 ? (
        <div className={styles.chips} role="group" aria-label={t('flights.kayak.airlineLabel')}>
          <button type="button" aria-pressed={!airlineFilter} className={!airlineFilter ? styles.chipOn : styles.chip} onClick={() => setAirlineFilter(null)}>
            {t('flights.kayak.allAirlines')}
          </button>
          {airlines.map(([code, a]) => (
            <button key={code} type="button" aria-pressed={airlineFilter === code} className={airlineFilter === code ? styles.chipOn : styles.chip} onClick={() => setAirlineFilter(airlineFilter === code ? null : code)}>
              {a.name}
            </button>
          ))}
        </div>
      ) : null}

      {data?.sandbox ? <p className={styles.sandbox}>{t('flights.kayak.sandbox')}</p> : null}

      {loading ? (
        <p className={styles.progress} role="status">
          <RefreshCw size={14} aria-hidden="true" className={styles.spin} /> {data && data.offers.length > 0 ? t('flights.kayak.searchingMore', { count: data.offers.length }) : t('flights.kayak.searching')}
        </p>
      ) : null}

      {error === 'failed' ? <p className={styles.error}>{t('flights.kayak.error')}</p> : null}

      {offers.length > 0 ? (
        <ul className={styles.list}>
          {offers.map((o) => (
            <OfferCard key={o.id} offer={o} places={data?.places ?? {}} currency={data?.currency ?? currency} language={i18n.language} travellers={travellers} />
          ))}
        </ul>
      ) : !loading && !error ? (
        <p className={styles.empty}>{t('flights.kayak.empty')}</p>
      ) : null}
      {offers.length > 0 ? <p className={styles.note}>{t('flights.kayak.priceNote')}</p> : null}
    </section>
  );
}
