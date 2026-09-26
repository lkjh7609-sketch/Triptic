import { useMemo, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import {
  Plus,
  Calendar,
  Plane,
  Search,
  Navigation,
  Lightbulb,
  Download,
  MoreVertical,
  Hotel,
  MapPin,
  Users,
  ArrowRight,
  ChevronRight,
  BadgeCheck,
  MapPinned,
  PenTool,
  BookOpen,
  Cloud,
  Map as MapIcon,
} from 'lucide-react';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';
import type { TripRow } from '@/shared/api/tripService';
import { tripService } from '@/shared/api/tripService';
import { useCityImage } from '@/shared/hooks/useCityImage';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile } from '@/shared/hooks/useProfile';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import { useWeather } from '@/features/weather/useWeather';
import { mapConditionCode, weatherIcon } from '@/features/weather/conditionMap';
import { formatTemp } from '@/features/weather/weatherRules';
import { captureError } from '@/shared/monitoring';
import { useHomeStats } from '@/features/home/useHomeStats';
import { StatsTiles } from '@/features/home/StatsTiles';
import { WorldMapCard } from '@/features/home/WorldMapCard';
import { getDDay, getTripPhase } from './tripStatus';
import { summarizeTrip, type TripSummary } from './tripSummary';
import { useTripMembers, initialsOf, type TripMember } from './hooks/useTripMembers';
import { formatLocalizedDay } from './planDateFormat';
import { CreateTripModal } from './CreateTripModal';
import type { DayCitiesData, ExpensesData, FlightsData, HotelsData, PlannerData } from './types';
import styles from './PlanDesktop.module.css';

interface PlanDesktopProps {
  trips: TripRow[];
  ongoing: TripRow[];
  upcoming: TripRow[];
  past: TripRow[];
  onRefetch: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenBackup: () => void;
}

type StatusFilter = 'all' | 'active' | 'past';
type PastView = 'grid' | 'list';

interface TripActions {
  onRename: (id: string, newTitle: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

const byStartDate = (a: TripRow, b: TripRow) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999');

function matchesQuery(trip: TripRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (trip.title ?? '').toLowerCase().includes(q) || (trip.city ?? '').toLowerCase().includes(q);
}

function formatRange(trip: TripRow, locale: string): string | null {
  if (!trip.start_date || !trip.end_date) return null;
  const start = formatLocalizedDay(parseISO(trip.start_date), locale);
  const end = formatLocalizedDay(parseISO(trip.end_date), locale);
  return `${start} – ${end}`;
}

/**
 * 계획 탭 데스크톱 (사용자 디자인). 화면의 모든 숫자·문구는 로그인한 사용자의 실제
 * 여행 데이터에서 계산한다 — 여행이 없으면 빈 상태를 보여주고 예시 데이터를 채우지 않는다.
 */
export function PlanDesktop({ trips, ongoing, upcoming, past, onRename, onDuplicate, onDelete, onOpenBackup }: PlanDesktopProps) {
  const { t } = useTranslation(['plan', 'common']);
  const { user } = useSession();
  const { data: profile } = useProfile();
  const stats = useHomeStats();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCreateCity = searchParams.get('autoCreate');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [pastView, setPastView] = useState<PastView>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const actions: TripActions = { onRename, onDuplicate, onDelete };

  const activeTrips = useMemo(() => [...ongoing, ...[...upcoming].sort(byStartDate)], [ongoing, upcoming]);
  const nextTrip = activeTrips[0] ?? null;
  const summaries = useMemo(() => new Map(trips.map((trip) => [trip.id, summarizeTrip(trip)])), [trips]);
  const members = useTripMembers(activeTrips.map((trip) => trip.id));

  const displayName =
    profile?.display_name?.trim() ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    t('desktop.fallbackName');

  const plannedDaysTotal = activeTrips.reduce((sum, trip) => sum + (summaries.get(trip.id)?.totalDays ?? 0), 0);
  const shownActive = filter === 'past' ? [] : activeTrips.filter((trip) => matchesQuery(trip, query));
  const shownPast = filter === 'active' ? [] : past.filter((trip) => matchesQuery(trip, query));
  const isFiltering = query.trim() !== '' || filter !== 'all';

  return (
    <main className={styles.container}>
      <section className={styles.headerSection}>
        <div className={styles.headerTop}>
          <div>
            <div className={styles.greetingBadge}>
              <BadgeCheck size={16} aria-hidden="true" />
              <span>{t('desktop.badge')}</span>
            </div>
            <h1 className={styles.pageTitle}>{t('desktop.welcome', { name: displayName })}</h1>
            <p className={styles.pageSubtitle}>
              <CountdownText nextTrip={nextTrip} isOngoing={ongoing.length > 0} />
            </p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.btnAi} onClick={onOpenBackup}>
              <Cloud size={16} /> {t('planScreen.backupFooter')}
            </button>
            <button type="button" className={styles.btnCreate} onClick={() => setShowCreate(true)}>
              <Plus size={20} /> {t('desktop.createTrip')}
            </button>
          </div>
        </div>

        <div className={styles.metricsBar}>
          <div className={styles.metricsLeft}>
            <div className={styles.metricBadge}>
              <span className={`${styles.statusDot} ${styles.statusDotUpcoming}`} aria-hidden="true" />
              <div>
                <span className={styles.metricValue}>{activeTrips.length}</span>
                <span className={styles.metricLabel}>{t('desktop.metricActive')}</span>
              </div>
            </div>
            <div className={styles.metricBadge}>
              <Calendar size={16} color="var(--pd-subtle)" aria-hidden="true" />
              <div>
                <span className={styles.metricValue}>{plannedDaysTotal}</span>
                <span className={styles.metricLabel}>{t('desktop.metricDays')}</span>
              </div>
            </div>
            <div className={styles.metricBadge}>
              <MapIcon size={16} color="var(--pd-subtle)" aria-hidden="true" />
              <div>
                <span className={styles.metricValue}>{past.length}</span>
                <span className={styles.metricLabel}>{t('desktop.metricPast')}</span>
              </div>
            </div>
          </div>
          <div className={styles.searchCapsule}>
            <Search size={20} color="var(--pd-subtle)" aria-hidden="true" />
            <input
              className={styles.searchInput}
              placeholder={t('desktop.searchPlaceholder')}
              aria-label={t('desktop.searchPlaceholder')}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className={styles.searchDivider} />
            <select
              className={styles.statusSelect}
              value={filter}
              onChange={(e) => setFilter(e.target.value as StatusFilter)}
              aria-label={t('desktop.statusFilterAria')}
            >
              <option value="all">{t('desktop.filterAll')}</option>
              <option value="active">{t('desktop.filterActive')}</option>
              <option value="past">{t('desktop.filterPast')}</option>
            </select>
          </div>
        </div>
      </section>

      {stats.data ? (
        <section className={styles.statsSection}>
          <StatsTiles stats={stats.data} />
          <WorldMapCard countries={stats.data.countries} />
        </section>
      ) : null}

      <div className={styles.pageLayout}>
        <div className={styles.mainColumn}>
          {shownActive.length > 0 && (
            <section className={styles.sectionStack}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitleRow}>
                  <h2 className={styles.sectionTitle}>{t('desktop.activeSection')}</h2>
                  <span className={styles.sectionBadge}>{t('desktop.activeCount', { count: shownActive.length })}</span>
                </div>
              </div>
              <div className={styles.compactGrid}>
                {shownActive.map((trip) => (
                  <CompactTripCard
                    key={trip.id}
                    trip={trip}
                    summary={summaries.get(trip.id) ?? summarizeTrip(trip)}
                    members={members.data?.[trip.id] ?? []}
                    actions={actions}
                  />
                ))}
              </div>
            </section>
          )}

          {shownPast.length > 0 && (
            <section className={styles.sectionStack}>
              <div className={styles.tabsRow}>
                <div className={styles.tabsList} role="tablist">
                  {(['all', 'active', 'past'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={filter === key}
                      className={`${styles.tabBtn} ${filter === key ? styles.active : ''}`}
                      onClick={() => setFilter(key)}
                    >
                      {key === 'all'
                        ? t('desktop.tabAll', { count: trips.length })
                        : key === 'active'
                          ? t('desktop.tabActive', { count: activeTrips.length })
                          : t('desktop.tabPast', { count: past.length })}
                    </button>
                  ))}
                </div>
                <div className={styles.viewToggles}>
                  <button
                    type="button"
                    className={`${styles.viewToggle} ${pastView === 'grid' ? styles.active : ''}`}
                    aria-pressed={pastView === 'grid'}
                    onClick={() => setPastView('grid')}
                  >
                    {t('desktop.viewGrid')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.viewToggle} ${pastView === 'list' ? styles.active : ''}`}
                    aria-pressed={pastView === 'list'}
                    onClick={() => setPastView('list')}
                  >
                    {t('desktop.viewList')}
                  </button>
                </div>
              </div>
              <div className={pastView === 'grid' ? styles.pastGrid : styles.pastList}>
                {shownPast.map((trip) => (
                  <PastTripCard
                    key={trip.id}
                    trip={trip}
                    summary={summaries.get(trip.id) ?? summarizeTrip(trip)}
                    actions={actions}
                    list={pastView === 'list'}
                  />
                ))}
              </div>
            </section>
          )}

          {shownActive.length === 0 && shownPast.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyBody}>
                <div className={styles.emptyIcon}>
                  <MapPinned size={22} aria-hidden="true" />
                </div>
                <div>
                  <h4 className={styles.emptyTitle}>{isFiltering ? t('desktop.noResultsTitle') : t('desktop.emptyTitle')}</h4>
                  <p className={styles.emptyText}>{isFiltering ? t('desktop.noResultsDesc') : t('desktop.emptyDesc')}</p>
                </div>
              </div>
              <button type="button" className={`${styles.btnCreate} ${styles.btnCreateSmall}`} onClick={() => setShowCreate(true)}>
                {t('desktop.emptyCta')}
              </button>
            </div>
          )}
        </div>

        <NextTripRail
          trip={nextTrip}
          members={nextTrip ? (members.data?.[nextTrip.id] ?? []) : []}
          onCreate={() => setShowCreate(true)}
        />
      </div>

      {(showCreate || autoCreateCity) && (
        <CreateTripModal
          autoCreateCity={autoCreateCity}
          onClose={() => {
            setShowCreate(false);
            if (autoCreateCity) {
              searchParams.delete('autoCreate');
              setSearchParams(searchParams, { replace: true });
            }
          }}
        />
      )}
    </main>
  );
}

/** "다음 여행까지 N일 남았어요" — 진행 중 / 오늘 출발 / N일 후 / 날짜 미정 / 예정 없음 */
function CountdownText({ nextTrip, isOngoing }: { nextTrip: TripRow | null; isOngoing: boolean }) {
  const { t } = useTranslation('plan');
  if (!nextTrip) return <>{t('desktop.subtitleNone')}</>;
  if (isOngoing && nextTrip.start_date) {
    const day = differenceInCalendarDays(startOfDay(new Date()), startOfDay(parseISO(nextTrip.start_date))) + 1;
    return <>{t('desktop.subtitleOngoing', { title: nextTrip.title, day })}</>;
  }
  const dday = getDDay(nextTrip.start_date);
  if (dday == null) return <>{t('desktop.subtitleUndated', { title: nextTrip.title })}</>;
  if (dday === 0) return <>{t('desktop.subtitleToday', { title: nextTrip.title })}</>;
  return (
    <>
      {t('desktop.subtitleCountdownBefore', { title: nextTrip.title })}
      <span className={styles.countdownDays}>{t('desktop.subtitleCountdownDays', { count: dday })}</span>
      {t('desktop.subtitleCountdownAfter')}
    </>
  );
}

function TripMenu({ trip, actions }: { trip: TripRow; actions: TripActions }) {
  const { t } = useTranslation(['plan', 'common']);
  const [open, setOpen] = useState(false);

  function stop(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className={styles.cardMenuWrap}>
      <button
        type="button"
        className={styles.cardMenuButton}
        aria-label={t('tripCard.menuAria')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
      >
        <MoreVertical size={16} />
      </button>
      {open ? (
        <div className={styles.cardMenu} role="menu" onMouseLeave={() => setOpen(false)}>
          <button
            type="button"
            role="menuitem"
            className={styles.cardMenuItem}
            onClick={(e) => {
              stop(e);
              setOpen(false);
              const next = window.prompt(t('tripCard.renamePrompt'), trip.title);
              if (next && next.trim()) actions.onRename(trip.id, next.trim());
            }}
          >
            {t('tripCard.rename')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.cardMenuItem}
            onClick={(e) => {
              stop(e);
              setOpen(false);
              actions.onDuplicate(trip.id);
            }}
          >
            {t('tripCard.duplicate')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${styles.cardMenuItem} ${styles.cardMenuDanger}`}
            onClick={(e) => {
              stop(e);
              setOpen(false);
              if (window.confirm(t('tripCard.deleteConfirm', { title: trip.title }))) actions.onDelete(trip.id);
            }}
          >
            {t('common:action.delete')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CompactTripCard({
  trip,
  summary,
  members,
  actions,
}: {
  trip: TripRow;
  summary: TripSummary;
  members: TripMember[];
  actions: TripActions;
}) {
  const { t, i18n } = useTranslation('plan');
  const bgImage = useCityImage(trip.city);
  const dday = getDDay(trip.start_date);
  const isOngoing = getTripPhase(trip.start_date, trip.end_date) === 'ongoing';
  const range = formatRange(trip, i18n.language);
  const travelerCount = Math.max(1, members.length);

  return (
    <Link to={`/plan/${trip.id}`} className={styles.compactCard}>
      <div className={styles.cardTop}>
        <div className={styles.cardImageWrap}>
          <img src={bgImage} className={styles.cardImage} alt="" />
          {dday !== null && !isOngoing ? (
            <span className={styles.dateBadge}>{dday === 0 ? t('desktop.dday0') : t('desktop.ddayN', { count: dday })}</span>
          ) : null}
        </div>
        <div className={styles.cardInfo}>
          <div className={styles.cardStatusRow}>
            <div className={styles.statusIndicator}>
              <span className={`${styles.statusDot} ${isOngoing ? styles.statusDotOngoing : styles.statusDotUpcoming}`} />
              <span className={isOngoing ? styles.statusTextOngoing : styles.statusTextUpcoming}>
                {isOngoing ? t('desktop.statusOngoing') : t('desktop.statusUpcoming')} ·{' '}
                {t('desktop.daysCount', { count: summary.totalDays })}
              </span>
            </div>
            <div className={styles.cardStatusRight}>
              <span className={styles.travelersBadge}>{t('desktop.travelers', { count: travelerCount })}</span>
              <TripMenu trip={trip} actions={actions} />
            </div>
          </div>
          <h3 className={styles.cardTitle}>{trip.title}</h3>
          <p className={styles.cardDesc}>{range ?? t('tripCard.periodUndecided')}</p>
          <div className={styles.cardRoute}>
            <Navigation size={14} color="var(--pd-accent)" aria-hidden="true" /> {trip.city || t('desktop.cityUnset')}
          </div>
        </div>
      </div>

      <div className={styles.cardProgressArea}>
        <div className={styles.progressRow}>
          <span className={styles.progressLabel}>{t('desktop.completeness')}</span>
          <span className={styles.progressValue}>
            {t('desktop.completenessValue', { planned: summary.plannedDays, total: summary.totalDays })}
          </span>
        </div>
        <div
          className={styles.progressBar}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.completeness}
          aria-label={t('desktop.completeness')}
        >
          <div
            className={`${styles.progressFill} ${isOngoing ? styles.progressOngoing : ''}`}
            style={{ width: `${summary.completeness}%` }}
          />
        </div>
        <div className={styles.logisticsChips}>
          <span className={`${styles.logisticsChip} ${summary.hasHotel ? '' : styles.chipOff}`}>
            <Hotel size={13} aria-hidden="true" /> {summary.hasHotel ? t('desktop.chipHotel') : t('desktop.chipHotelMissing')}
          </span>
          <span className={`${styles.logisticsChip} ${summary.hasFlight ? '' : styles.chipOff}`}>
            <Plane size={13} aria-hidden="true" /> {summary.hasFlight ? t('desktop.chipFlight') : t('desktop.chipFlightMissing')}
          </span>
          <span className={styles.logisticsChip}>
            <MapPin size={13} aria-hidden="true" /> {t('desktop.chipPlaces', { count: summary.placeCount })}
          </span>
        </div>
      </div>

      <div className={styles.cardBottom}>
        <div className={styles.avatars}>
          {members.slice(0, 4).map((m, i) => (
            <div key={m.userId} className={`${styles.avatar} ${i === 0 ? styles.avatarPrimary : ''}`} title={m.name ?? undefined}>
              {initialsOf(m.name)}
            </div>
          ))}
        </div>
        <div className={`${styles.btnOpen} ${isOngoing ? styles.btnOpenActive : ''}`}>
          {t('desktop.openItinerary')} <ArrowRight size={14} aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}

function PastTripCard({ trip, summary, actions, list }: { trip: TripRow; summary: TripSummary; actions: TripActions; list: boolean }) {
  const { t, i18n } = useTranslation('plan');
  const bgImage = useCityImage(trip.city);
  const range = formatRange(trip, i18n.language);

  return (
    <Link to={`/plan/${trip.id}`} className={`${styles.pastCard} ${list ? styles.pastCardList : ''}`}>
      <div className={styles.pastImageWrap}>
        <img src={bgImage} className={styles.pastImage} alt="" />
        <div className={styles.pastBadge}>{t('desktop.pastBadge', { count: summary.totalDays })}</div>
      </div>
      <div className={styles.pastBody}>
        <div>
          <div className={styles.pastMeta}>
            <span>{trip.city || t('desktop.cityUnset')}</span>
            <TripMenu trip={trip} actions={actions} />
          </div>
          <h4 className={styles.pastTitle}>{trip.title}</h4>
          <p className={styles.pastDesc}>{range ?? t('tripCard.periodUndecided')}</p>
        </div>
        <div className={styles.pastFooter}>
          <div className={styles.pastStat}>
            <MapPin size={15} color="var(--pd-accent)" aria-hidden="true" /> {t('desktop.chipPlaces', { count: summary.placeCount })}
          </div>
          <div className={styles.pastOpen}>
            {t('desktop.view')} <ChevronRight size={15} aria-hidden="true" />
          </div>
        </div>
      </div>
    </Link>
  );
}

/** 오른쪽 레일 — 다음 여행 준비 상황(날씨·항공편·PDF·동행자). 전부 그 여행의 실제 데이터만 쓴다 */
function NextTripRail({ trip, members, onCreate }: { trip: TripRow | null; members: TripMember[]; onCreate: () => void }) {
  const { t } = useTranslation('plan');

  return (
    <aside className={styles.rightRail}>
      <div className={styles.toolkitWidget}>
        <div className={styles.toolkitHeader}>
          <div className={styles.toolkitTitleRow}>
            <PenTool size={22} color="var(--pd-accent)" aria-hidden="true" />
            <h3 className={styles.toolkitTitle}>{t('desktop.toolkitTitle')}</h3>
          </div>
          {trip ? (
            <Link to={`/plan/${trip.id}`} className={styles.syncBadge}>
              {trip.title}
            </Link>
          ) : null}
        </div>

        {trip ? (
          <>
            <WeatherBox trip={trip} />
            <FlightBox trip={trip} />
            <PdfBox trip={trip} />
            <div className={styles.membersBlock}>
              <h4 className={styles.membersTitle}>
                <Users size={16} aria-hidden="true" /> {t('desktop.membersTitle')}
              </h4>
              {members.length <= 1 ? (
                <p className={styles.toolkitEmpty}>{t('desktop.membersSolo')}</p>
              ) : (
                members.map((m) => (
                  <div key={m.userId} className={styles.memberRow}>
                    <div className={styles.memberAvatar}>{initialsOf(m.name)}</div>
                    <div>
                      <div className={styles.memberName}>{m.name ?? t('desktop.memberUnknown')}</div>
                      <div className={styles.memberRole}>{t(`desktop.role.${m.role}`, { defaultValue: m.role })}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <p className={styles.toolkitEmpty}>{t('desktop.toolkitEmpty')}</p>
            <button type="button" className={`${styles.btnCreate} ${styles.btnCreateSmall}`} onClick={onCreate}>
              <Plus size={16} /> {t('desktop.createTrip')}
            </button>
          </>
        )}

        <div className={styles.tipBox}>
          <div className={styles.tipLabel}>
            <Lightbulb size={16} aria-hidden="true" /> {t('desktop.tipLabel')}
          </div>
          <p className={styles.tipText}>{t('desktop.tipText')}</p>
        </div>
      </div>
    </aside>
  );
}

function WeatherBox({ trip }: { trip: TripRow }) {
  const { t } = useTranslation('plan');
  const tempUnit = useTempUnit();
  const weather = useWeather(trip.city_lat, trip.city_lng, trip.start_date, trip.end_date);
  const first = weather.data?.daily?.[0];
  // 날씨 서비스가 없거나(503) 예보가 없으면 칸 자체를 숨긴다 — 가짜 값을 채우지 않는다(05-weather.md §6.3)
  if (!first) return null;
  const min = formatTemp(first.tempMinC, tempUnit);
  const max = formatTemp(first.tempMaxC, tempUnit);
  const icon = first.conditionCode ? weatherIcon(mapConditionCode(first.conditionCode), true) : null;

  return (
    <div className={styles.toolkitBox}>
      <div className={styles.toolkitBoxHeader}>
        <span>{t('desktop.weatherTitle')}</span>
        <span className={styles.accentText}>{(trip.city ?? '').split(',')[0]}</span>
      </div>
      <div className={styles.toolkitBoxContent}>
        <div className={styles.toolkitBoxLeft}>
          {icon ? (
            <span className={styles.weatherIcon} aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div>
            <div className={styles.toolkitValue}>
              {min ?? '–'} / {max ?? '–'}
            </div>
            <div className={styles.toolkitSub}>
              {first.source === 'climate_normal' ? t('tripDetail.climateBadge') : t('desktop.weatherFirstDay')}
            </div>
          </div>
        </div>
        {first.precipChance != null ? (
          <div className={styles.weatherPrecip}>{t('desktop.precip', { value: Math.round(first.precipChance * 100) })}</div>
        ) : null}
      </div>
    </div>
  );
}

function FlightBox({ trip }: { trip: TripRow }) {
  const { t } = useTranslation('plan');
  const flights = (tripService.toLocalProject(trip).flights ?? { outbound: null, return: null }) as FlightsData;
  const outbound = flights.outbound;

  if (!outbound) {
    return (
      <Link to={`/plan/${trip.id}`} className={styles.toolkitLink}>
        <div className={styles.toolkitLinkBody}>
          <div className={styles.toolkitLinkIcon}>
            <Plane size={18} aria-hidden="true" />
          </div>
          <div>
            <div className={styles.toolkitLinkTitle}>{t('desktop.flightMissingTitle')}</div>
            <div className={styles.toolkitLinkSub}>{t('desktop.flightMissingDesc')}</div>
          </div>
        </div>
        <ChevronRight size={18} color="var(--pd-subtle)" aria-hidden="true" />
      </Link>
    );
  }

  const route = [outbound.dep?.iata || outbound.dep?.name, outbound.arr?.iata || outbound.arr?.name].filter(Boolean).join(' → ');
  const times = [outbound.dep?.time, outbound.arr?.time].filter(Boolean).join(' → ');
  return (
    <div className={styles.toolkitAlert}>
      <Plane size={22} color="var(--pd-accent)" className={styles.flightIcon} aria-hidden="true" />
      <div>
        <div className={styles.flightNo}>{[outbound.airline, outbound.flightNo].filter(Boolean).join(' ')}</div>
        <p className={styles.flightMeta}>
          {route}
          {times ? ` · ${times}` : ''}
        </p>
      </div>
    </div>
  );
}

function PdfBox({ trip }: { trip: TripRow }) {
  const { t } = useTranslation('plan');
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    try {
      const project = tripService.toLocalProject(trip);
      const { exportToPdf } = await import('./pdfExport');
      await exportToPdf(
        {
          title: trip.title,
          city: trip.city ?? '',
          startDate: trip.start_date ?? '',
          endDate: trip.end_date ?? '',
          totalDays: Math.max(1, Number(project.totalDays ?? trip.total_days ?? 1) || 1),
          currency: project.currency ?? 'KRW',
          currentDay: 1,
          plannerData: (project.data ?? {}) as PlannerData,
          hotelsData: (project.hotels ?? {}) as HotelsData,
          flightsData: (project.flights ?? { outbound: null, return: null }) as FlightsData,
          expensesData: (project.expenses ?? {}) as ExpensesData,
          dayCitiesData: (project.dayCities ?? {}) as DayCitiesData,
        },
        'all',
      );
    } catch (err) {
      captureError(err, { context: 'planDesktop.pdfExport' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={styles.toolkitLink} onClick={handleExport} disabled={busy}>
      <div className={styles.toolkitLinkBody}>
        <div className={styles.toolkitLinkIcon}>
          <BookOpen size={18} aria-hidden="true" />
        </div>
        <div>
          <div className={styles.toolkitLinkTitle}>{busy ? t('share.generatingPdf') : t('desktop.pdfTitle')}</div>
          <div className={styles.toolkitLinkSub}>{t('desktop.pdfDesc')}</div>
        </div>
      </div>
      <Download size={18} color="var(--pd-subtle)" aria-hidden="true" />
    </button>
  );
}
