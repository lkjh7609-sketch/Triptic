import { useTranslation } from 'react-i18next';
import type { ContinentKey } from '@/features/community/destinationRegions';
import { WorldMap } from './WorldMap';
import { PixelSprite } from './PixelSprite';
import { avatarGrid } from './pixelArt';
import { BadgeArt, type BadgeKind } from './BadgeArt';
import type { Friend } from './friends';
import type { Badge, TravelStats, TripStat } from './statsCompute';
import { CHART_COLORS, countryName, flagOf, krw, num, shortDate } from './statsFormat';
import styles from './Stats.module.css';

type TFn = (key: string, options?: Record<string, unknown>) => string;

/** 1. 요약 띠 */
export function SummaryStrip({ stats }: { stats: TravelStats }) {
  const { t, i18n } = useTranslation('stats');
  const lang = i18n.language;
  const tiles = [
    { label: t('summary.trips'), value: t('summary.tripsValue', { count: stats.pastCount }) },
    { label: t('summary.days'), value: t('summary.daysValue', { count: stats.totalDays }) },
    { label: t('summary.cities'), value: t('summary.citiesValue', { count: stats.cityCount }) },
    { label: t('summary.countries'), value: t('summary.countriesValue', { count: stats.countryCount }) },
  ];
  return (
    <section className={styles.card} aria-label={t('title')}>
      <div className={styles.summary}>
        {tiles.map((x) => (
          <div key={x.label} className={styles.tile}>
            <span className={styles.tileValue}>{x.value}</span>
            <span className={styles.tileLabel}>{x.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.note}>
        {t('summary.km', { km: num(stats.totalKm, lang) })}
        {stats.upcomingCount > 0 ? ` · ${t('summary.upcoming', { count: stats.upcomingCount })}` : ''}
      </p>
    </section>
  );
}

/** 같이 다닌 친구들 — 도트 캐릭터로. 나는 늘 맨 앞, 같이 다닌 친구가 없으면(여행이 없을 때 포함) 나 혼자 */
export function CompanionsSection({ friends, meId, meName }: { friends: Friend[]; meId: string; meName: string | null }) {
  const { t } = useTranslation('stats');
  return (
    <section className={styles.card} aria-labelledby="stats-friends-title">
      <h2 id="stats-friends-title" className={styles.cardTitle}>{t('friends.title')}</h2>
      <ul className={styles.friends}>
        <li className={styles.friend}>
          <PixelSprite grid={avatarGrid(meId)} pixel={3} className={`${styles.avatar} ${styles.avatarMe}`} label={t('friends.me')} />
          <span className={styles.friendName}>{t('friends.me')}</span>
          <span className={styles.friendSub}>{meName ?? ''}</span>
        </li>
        {friends.map((f) => (
          <li key={f.userId} className={styles.friend}>
            <PixelSprite grid={avatarGrid(f.userId)} pixel={3} className={styles.avatar} label={f.name ?? t('friends.unnamed')} />
            <span className={styles.friendName}>{f.name ?? t('friends.unnamed')}</span>
            <span className={styles.friendSub}>{t('friends.together', { count: f.trips })}</span>
          </li>
        ))}
      </ul>
      {friends.length === 0 ? <p className={styles.note}>{t('friends.alone')}</p> : null}
    </section>
  );
}

/** 막대 목록 한 줄들 */
function Bars({ rows }: { rows: { key: string; label: string; value: number; text: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className={styles.barList}>
      {rows.map((r) => (
        <li key={r.key} className={styles.barRow}>
          <span className={styles.barLabel}>{r.label}</span>
          <span className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
          </span>
          <span className={styles.barValue}>{r.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** 2. 세계 지도 + 대륙 비율 */
export function WorldSection({ stats }: { stats: TravelStats }) {
  const { t, i18n } = useTranslation('stats');
  const lang = i18n.language;
  return (
    <section className={styles.card} aria-labelledby="stats-map-title">
      <h2 id="stats-map-title" className={styles.cardTitle}>{t('map.title')}</h2>
      <WorldMap countries={stats.countries.map((c) => c.code)} places={stats.visited} />
      <p className={styles.note}>{t('map.world', { count: stats.countryCount, percent: stats.countryPercentOfWorld })}</p>
      {stats.countries.length > 0 ? (
        <div className={styles.chips}>
          {stats.countries.map((c) => (
            <span key={c.code} className={styles.chip}>
              {flagOf(c.code)} {countryName(c.code, lang)}
            </span>
          ))}
        </div>
      ) : null}
      {stats.continents.length > 0 ? (
        <>
          <h3 className={styles.subTitle}>{t('map.continents')}</h3>
          <Bars
            rows={stats.continents.map((c) => ({
              key: c.key,
              label: t(`label.continent.${c.key as ContinentKey}`),
              value: c.trips,
              text: `${c.percent}%`,
            }))}
          />
          <p className={styles.note}>{t('map.continentNote')}</p>
        </>
      ) : null}
      {stats.unknownPlaces > 0 ? <p className={styles.note}>{t('map.unknown', { count: stats.unknownPlaces })}</p> : null}
    </section>
  );
}

function Donut({ rows, total }: { rows: { key: string; label: string; value: number }[]; total: number }) {
  const { i18n } = useTranslation('stats');
  // 각 조각의 시작·끝 비율(누적합) — 렌더 중 변수를 바꾸지 않고 계산한다
  const ends = rows.reduce<number[]>((list, r) => [...list, (list[list.length - 1] ?? 0) + r.value], []);
  const stops = rows
    .map((_, i) => `${CHART_COLORS[i % CHART_COLORS.length]} ${((ends[i - 1] ?? 0) / total) * 100}% ${(ends[i]! / total) * 100}%`)
    .join(', ');
  return (
    <div className={styles.donutWrap}>
      <div className={styles.donut} style={{ background: `conic-gradient(${stops})` }} aria-hidden="true">
        <div className={styles.donutHole} />
      </div>
      <ul className={styles.legend}>
        {rows.map((r, i) => (
          <li key={r.key} className={styles.legendRow}>
            <span className={styles.swatch} style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span>{r.label}</span>
            <span className={styles.legendValue}>{krw(r.value, i18n.language, true)}</span>
            <span className={styles.legendPct}>{Math.round((r.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 3. 경비 */
export function ExpenseSection({ stats }: { stats: TravelStats }) {
  const { t, i18n } = useTranslation('stats');
  const lang = i18n.language;
  const e = stats.expense;
  const tt = t as unknown as TFn;
  if (e.tripsWithExpense === 0) {
    return (
      <section className={styles.card} aria-labelledby="stats-exp-title">
        <h2 id="stats-exp-title" className={styles.cardTitle}>{t('expense.title')}</h2>
        <p className={`${styles.note} ${styles.oneLine}`}>{t('expense.none')}</p>
        {e.noRate > 0 ? <p className={`${styles.note} ${styles.oneLine}`}>{t('expense.noRate', { count: e.noRate })}</p> : null}
      </section>
    );
  }
  const withExp = stats.trips.filter((x) => x.expenseKrw != null && x.expenseKrw > 0);
  const payTotal = e.byPayment.reduce((s, r) => s + r.krw, 0);
  return (
    <section className={styles.card} aria-labelledby="stats-exp-title">
      <h2 id="stats-exp-title" className={styles.cardTitle}>{t('expense.title')}</h2>
      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>{t('expense.total')}</span>
          <span className={styles.kpiValue}>{krw(e.totalKrw, lang)}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>{t('expense.perDay')}</span>
          <span className={styles.kpiValue}>{e.perDayKrw != null ? krw(e.perDayKrw, lang) : '–'}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>{t('expense.perTrip')}</span>
          <span className={styles.kpiValue}>{e.perTripKrw != null ? krw(e.perTripKrw, lang) : '–'}</span>
        </div>
        <div className={styles.kpi}>
          <span className={styles.kpiLabel}>{t('expense.mostExpensive')}</span>
          <span className={styles.kpiValue}>{e.mostExpensive ? krw(e.mostExpensive.expenseKrw ?? 0, lang) : '–'}</span>
          {e.mostExpensive ? <span className={styles.kpiSub}>{e.mostExpensive.title}</span> : null}
        </div>
      </div>

      <div className={styles.two}>
        <div>
          <h3 className={styles.subTitle}>{t('expense.byCategory')}</h3>
          <Donut
            total={e.totalKrw}
            rows={e.byCategory.map((r) => ({ key: r.key, label: tt(`label.expense.${r.key in { food: 1, transport: 1, lodging: 1, shopping: 1, activity: 1 } ? r.key : 'other'}`), value: r.krw }))}
          />
        </div>
        <div>
          <h3 className={styles.subTitle}>{t('expense.byPayment')}</h3>
          <div className={styles.stack} aria-hidden="true">
            {e.byPayment.map((r, i) => (
              <span key={r.key} style={{ width: `${(r.krw / payTotal) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
            ))}
          </div>
          <ul className={styles.legend} style={{ marginTop: 12 }}>
            {e.byPayment.map((r, i) => (
              <li key={r.key} className={styles.legendRow}>
                <span className={styles.swatch} style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span>{tt(`label.payment.${r.key in { cash: 1, card: 1, other: 1, unknown: 1 } ? r.key : 'other'}`)}</span>
                <span className={styles.legendValue}>{krw(r.krw, lang, true)}</span>
                <span className={styles.legendPct}>{Math.round((r.krw / payTotal) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className={styles.subTitle}>{t('expense.byTrip')}</h3>
      <Bars
        rows={withExp.map((x) => ({
          key: x.id,
          label: x.title,
          value: x.expenseKrw ?? 0,
          text: `${krw(x.expenseKrw ?? 0, lang, true)} · ${t('expense.perDayShort', { amount: krw((x.expenseKrw ?? 0) / x.days, lang, true) })}`,
        }))}
      />
      {e.tripsWithoutExpense > 0 ? <p className={`${styles.note} ${styles.oneLine}`}>{t('expense.noRecord', { count: e.tripsWithoutExpense })}</p> : null}
      {e.noRate > 0 ? <p className={`${styles.note} ${styles.oneLine}`}>{t('expense.noRate', { count: e.noRate })}</p> : null}
      <p className={`${styles.note} ${styles.oneLine}`}>{t('expense.note')}</p>
    </section>
  );
}

/** 4. 여행 습관 */
export function HabitsSection({ stats }: { stats: TravelStats }) {
  const { t, i18n } = useTranslation('stats');
  const lang = i18n.language;
  const tt = t as unknown as TFn;
  const h = stats.habits;
  const maxMonth = Math.max(1, ...h.byMonth);
  const placeLabel = (k: string) => tt(`label.place.${k in { sight: 1, meal: 1, restaurant: 1, cafe: 1, shopping: 1, lodging: 1, transport: 1 } ? k : 'other'}`);
  return (
    <section className={styles.card} aria-labelledby="stats-habit-title">
      <h2 id="stats-habit-title" className={styles.cardTitle}>{t('habits.title')}</h2>
      <div className={styles.two}>
        <div>
          <h3 className={styles.subTitle} style={{ marginTop: 0 }}>{t('habits.byMonth')}</h3>
          <div className={styles.months}>
            {h.byMonth.map((n, i) => (
              <div key={i} className={styles.month} title={`${t('habits.monthLabel', { month: i + 1 })}: ${n}`}>
                <span className={`${styles.monthBar} ${n === 0 ? styles.monthBarEmpty : ''}`} style={{ height: `${n === 0 ? 3 : Math.max(8, (n / maxMonth) * 88)}px` }} />
                <span>{i + 1}</span>
              </div>
            ))}
          </div>
          <h3 className={styles.subTitle}>{t('habits.byYear')}</h3>
          {h.byYear.length === 0 ? <p className={styles.note}>{t('habits.yearNone')}</p> : null}
          <ul className={styles.table}>
            {h.byYear.map((y) => (
              <li key={y.year} className={styles.tableRow}>
                <span className={styles.tableYear}>{y.year}</span>
                <span className={styles.tableMain}>{t('habits.yearRow', { trips: y.trips, days: y.days })}</span>
                <span className={styles.tableSub}>{y.krw > 0 ? krw(y.krw, lang, true) : '–'}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt>{t('habits.avgDays')}</dt>
              <dd>{t('trips.days', { count: Math.round(h.avgDays * 10) / 10 })}</dd>
            </div>
            <div className={styles.fact}>
              <dt>{t('habits.longest')}</dt>
              <dd>{h.longest ? `${h.longest.title} · ${t('trips.days', { count: h.longest.days })}` : '–'}</dd>
            </div>
            <div className={styles.fact}>
              <dt>{t('habits.placesPerDay')}</dt>
              <dd>{t('habits.placesPerDayValue', { value: num(h.placesPerDay, lang, 1) })}</dd>
            </div>
          </dl>
          {h.topCities.length > 0 ? (
            <>
              <h3 className={styles.subTitle}>{t('habits.topCities')}</h3>
              <Bars rows={h.topCities.map((c) => ({ key: c.name, label: c.name, value: c.trips, text: t('habits.topCityTrips', { count: c.trips }) }))} />
            </>
          ) : null}
          {h.placeCategories.length > 0 ? (
            <>
              <h3 className={styles.subTitle}>{t('habits.categories')}</h3>
              <Bars rows={h.placeCategories.slice(0, 5).map((c) => ({ key: c.key, label: placeLabel(c.key), value: c.count, text: String(c.count) }))} />
            </>
          ) : null}
        </div>
      </div>
      <div className={`${styles.styleBox} ${styles.oneLine}`}>
        <span className={styles.styleLabel}>{t('habits.styleTitle')}</span>
        {h.style ? t(`habits.style.${h.style}`) : t('habits.styleNeed')}
      </div>
    </section>
  );
}

/** 5. 여행별 통계 */
export function TripsSection({ trips, expanded, onToggle }: { trips: TripStat[]; expanded: string | null; onToggle: (id: string) => void }) {
  const { t, i18n } = useTranslation('stats');
  const lang = i18n.language;
  const tt = t as unknown as TFn;
  return (
    <section className={styles.card} aria-labelledby="stats-trips-title">
      <h2 id="stats-trips-title" className={styles.cardTitle}>{t('trips.title')}</h2>
      {trips.length === 0 ? <p className={styles.note}>{t('trips.none')}</p> : null}
      <ul className={styles.tripList}>
        {trips.map((trip) => {
          const open = expanded === trip.id;
          const dayMax = Math.max(1, ...Object.values(trip.expenseByDay));
          return (
            <li key={trip.id} className={styles.trip}>
              <button type="button" className={styles.tripHead} onClick={() => onToggle(trip.id)} aria-expanded={open}>
                <span>
                  <span className={styles.tripName}>{trip.title}</span>
                  <span className={styles.tripMeta}>
                    {shortDate(trip.startDate, lang)} ~ {shortDate(trip.endDate, lang)} · {t('trips.days', { count: trip.days })}
                  </span>
                  <span className={styles.tripChips}>
                    <span className={styles.chip}>{t('trips.places', { count: trip.placeCount })}</span>
                    {trip.flights > 0 ? <span className={styles.chip}>{t('trips.flights', { count: trip.flights })}</span> : null}
                    <span className={styles.chip}>{trip.expenseKrw != null ? krw(trip.expenseKrw, lang, true) : t('trips.noExpense')}</span>
                    {trip.companions ? <span className={styles.chip}>{t('trips.companions')}</span> : null}
                  </span>
                </span>
                <span className={styles.tripToggle}>{open ? t('trips.collapse') : t('trips.expand')}</span>
              </button>
              {open ? (
                <div className={styles.tripBody}>
                  <dl className={styles.facts} style={{ marginTop: 12 }}>
                    <div className={styles.fact}>
                      <dt>{t('trips.countries')}</dt>
                      <dd>{trip.countries.length > 0 ? trip.countries.map((c) => `${flagOf(c)} ${countryName(c, lang)}`).join(', ') : '–'}</dd>
                    </div>
                    <div className={styles.fact}>
                      <dt>{t('trips.distance')}</dt>
                      <dd>{trip.distanceKm > 0 ? `${num(trip.distanceKm, lang)}km` : '–'}</dd>
                    </div>
                    <div className={styles.fact}>
                      <dt>{t('trips.airlines')}</dt>
                      <dd>{trip.airlines.length > 0 ? trip.airlines.join(', ') : '–'}</dd>
                    </div>
                    <div className={styles.fact}>
                      <dt>{t('trips.categories')}</dt>
                      <dd>
                        {Object.keys(trip.placeCategories).length > 0
                          ? Object.entries(trip.placeCategories)
                              .sort((a, b) => b[1] - a[1])
                              .map(([k, n]) => `${tt(`label.place.${k in { sight: 1, meal: 1, restaurant: 1, cafe: 1, shopping: 1, lodging: 1, transport: 1 } ? k : 'other'}`)} ${n}`)
                              .join(' · ')
                          : '–'}
                      </dd>
                    </div>
                  </dl>
                  {trip.expenseKrw != null ? (
                    <>
                      <h3 className={styles.subTitle}>{t('trips.dayExpense')}</h3>
                      <div className={styles.dayBars}>
                        {Array.from({ length: trip.days }, (_, i) => i + 1).map((d) => {
                          const v = trip.expenseByDay[d] ?? 0;
                          return (
                            <div key={d} className={styles.dayBar} title={`${t('trips.dayLabel', { day: d })}: ${krw(v, lang)}`}>
                              <span className={styles.dayBarFill} style={{ height: `${v === 0 ? 3 : Math.max(8, (v / dayMax) * 60)}px`, opacity: v === 0 ? 0.25 : 1 }} />
                              <span>{d}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const ALL_BADGES: Badge['key'][] = ['firstTrip', 'firstAbroad', 'firstCompanion', 'countries3', 'countries5', 'countries10', 'trips5', 'trips10', 'trips20', 'days30', 'days100', 'days365'];

/** 6. 기록(이정표) */
export function BadgesSection({ badges }: { badges: Badge[] }) {
  const { t, i18n } = useTranslation('stats');
  const got = new Map(badges.map((b) => [b.key, b.date]));
  return (
    <section className={styles.card} aria-labelledby="stats-badge-title">
      <h2 id="stats-badge-title" className={styles.cardTitle}>{t('badges.title')}</h2>
      <div className={styles.badges}>
        {ALL_BADGES.map((k) => {
          const date = got.get(k);
          return (
            <div key={k} className={`${styles.badge} ${date ? '' : styles.badgeLocked}`}>
              <BadgeArt kind={k as BadgeKind} locked={!date} />
              <span className={styles.badgeName}>{t(`badges.name.${k}`)}</span>
              <span className={styles.badgeDate}>{date ? shortDate(date, i18n.language) : ''}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
