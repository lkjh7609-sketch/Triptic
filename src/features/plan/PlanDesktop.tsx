import { useMemo, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { flightAirlineLabel } from './flights';
import { Link, useNavigate, useSearchParams } from 'react-router';
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
  ChevronRight,
  BadgeCheck,
  MapPinned,
  PenTool,
  BookOpen,
  Map as MapIcon,
} from 'lucide-react';
import { differenceInCalendarDays, format, parseISO, startOfDay } from 'date-fns';
import type { TripRow } from '@/shared/api/tripService';
import { tripService } from '@/shared/api/tripService';
import { useCityImage } from '@/shared/hooks/useCityImage';
import { useSession } from '@/shared/hooks/useSession';
import { SavedTravelogues } from './SavedTravelogues';
import { useProfile } from '@/shared/hooks/useProfile';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import { useWeather } from '@/features/weather/useWeather';
import { TripWeatherChip } from '@/features/weather/TripWeatherChip';
import { mapConditionCode, weatherIcon } from '@/features/weather/conditionMap';
import { formatTemp } from '@/features/weather/weatherRules';
import { captureError } from '@/shared/monitoring';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { useHomeStats, type TravelStats } from '@/features/home/useHomeStats';
import { requireLogin } from '@/features/auth/loginPrompt';
import { LoginRequiredDialog } from '@/features/auth/LoginRequiredDialog';
import { StatsTiles } from '@/features/home/StatsTiles';
import { WorldMapCard } from '@/features/home/WorldMapCard';
import { getDDay, getTripPhase } from './tripStatus';
import { summarizeTrip, type TripSummary } from './tripSummary';
import { useFinalizeTrip, useGuestTrips, useLeaveTrip, useTrip, useTripSummaries } from './hooks/useTrips';
import { GUEST_TRIP_LIMIT, isGuestTripId } from './guestTrips';
import { useTripMembers, initialsOf, type TripMember } from './hooks/useTripMembers';
import { formatLocalizedDay } from './planDateFormat';
import { cityDisplayName } from './cityName';
import { CreateTripModal } from './CreateTripModal';
import { FirstTripGuideDialog } from './FirstTripGuideDialog';
import { markFirstTripGuideAnswered, shouldAskFirstTripGuide } from './firstTripGuide';
import { openFlightsSearchForTrip, useTripFlightsLink } from './flightsSearchLink';
import { DepartureChecklist } from './DepartureChecklist';
import { SAMPLE_TRIP_ID } from './sampleTrip';
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
  /** 비로그인 둘러보기 — 샘플 여행 하나로 같은 대시보드를 보여 주고, 여행 만들기·편집만 로그인으로 막는다 */
  guest?: boolean;
}

type StatusFilter = 'all' | 'active' | 'past';
type PastView = 'grid' | 'list';

interface TripActions {
  onRename: (id: string, newTitle: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  /** 공유 링크로 참여한 여행(내가 소유자가 아님)은 삭제 대신 나가기 */
  onLeave?: (id: string) => void;
  currentUserId?: string;
  /** 있으면 메뉴 항목이 잠겨 있고, 누르면 이것만 부른다(비로그인 샘플 여행) */
  onLocked?: () => void;
}

/** 비로그인은 통계가 없다 — 막 가입한 사용자와 같은 빈 통계로 보여 준다 */
const GUEST_STATS: TravelStats = {
  tripCount: 0,
  countryCount: 0,
  cityCount: 0,
  dayCount: 0,
  placeCount: 0,
  groundMeters: 0,
  countries: [],
  companionCount: 0,
};

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
export function PlanDesktop({ trips, ongoing, upcoming, past, onRename, onDuplicate, onDelete, guest = false }: PlanDesktopProps) {
  const { t } = useTranslation(['plan', 'common']);
  const { user } = useSession();
  const { data: profile } = useProfile();
  const stats = useHomeStats();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoCreateCity = searchParams.get('autoCreate');
  const autoCreatePlaceId = searchParams.get('placeId');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [pastView, setPastView] = useState<PastView>('grid');
  const [showCreate, setShowCreate] = useState(false);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  // 가입하고 처음 새 여행을 만들려 할 때 가이드를 볼지 한 번 묻는다(firstTripGuide.ts)
  const [guideAnswered, setGuideAnswered] = useState(false);
  const [guideManual, setGuideManual] = useState(false);
  const navigate = useNavigate();
  const leaveTrip = useLeaveTrip();
  const actions: TripActions = guest
    ? { onRename, onDuplicate, onDelete, onLocked: () => setShowLoginRequired(true) }
    : { onRename, onDuplicate, onDelete, onLeave: (id) => leaveTrip.mutate(id), currentUserId: user?.id };
  const statsData = guest ? GUEST_STATS : stats.data;
  // 비로그인은 이 기기에 임시 여행을 만든다(GUEST_TRIP_LIMIT개까지) — 로그인하면 계정으로 옮겨진다.
  // 한도가 차면 로그인 창을 연다
  const guestTrips = useGuestTrips();
  const askGuide = !guest && shouldAskFirstTripGuide(user?.id, trips.length, guideAnswered);
  const openCreate = () => {
    if (guest && guestTrips.length >= GUEST_TRIP_LIMIT) {
      showToast(t('common:guest.draftLimit', { count: GUEST_TRIP_LIMIT }));
      requireLogin();
    } else if (askGuide) setGuideManual(true);
    else setShowCreate(true);
  };
  const guideOpen = askGuide && (guideManual || !!autoCreateCity);
  function answerGuide(openGuide: boolean) {
    if (user) markFirstTripGuideAnswered(user.id);
    setGuideAnswered(true);
    if (openGuide) {
      navigate('/guide');
      return;
    }
    if (guideManual) setShowCreate(true);
    setGuideManual(false);
  }

  const activeTrips = useMemo(() => [...ongoing, ...[...upcoming].sort(byStartDate)], [ongoing, upcoming]);
  const nextTrip = activeTrips[0] ?? null;
  // listTrips()는 비용이 드는 정규화 테이블 재구성을 건너뛰어 trip.content가
  // 비어 있다 — summarizeTrip(trip)만으로는 완성도/장소/호텔/항공이 전부
  // 0/미정으로 보이므로, 집계 전용 RPC(get_trip_summaries) 결과로 덮어쓴다.
  const tripSummaries = useTripSummaries(!guest);
  const summaries = useMemo(
    () =>
      new Map(
        trips.map((trip) => {
          const base = summarizeTrip(trip);
          const real = tripSummaries.data?.[trip.id];
          if (!real) return [trip.id, base] as const;
          return [
            trip.id,
            {
              ...base,
              plannedDays: real.plannedDays,
              placeCount: real.placeCount,
              hasHotel: real.hasHotel,
              hasFlight: real.hasFlight,
              completeness: Math.round((real.plannedDays / base.totalDays) * 100),
            },
          ] as const;
        }),
      ),
    [trips, tripSummaries.data],
  );
  // 임시 여행(guest-…)은 서버에 없다 — 멤버 조회에 넣으면 uuid가 아니라 요청 전체가 실패한다
  const members = useTripMembers(guest ? [] : activeTrips.filter((trip) => !isGuestTripId(trip.id)).map((trip) => trip.id));
  // NextTripRail의 날씨/항공편/PDF는 실제 콘텐츠가 필요하다 — nextTrip은
  // listTrips() 결과라 content가 비어 있으므로 단일 여행 조회로 다시 채운다.
  const nextTripDetail = useTrip(nextTrip?.id);

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
            <button type="button" className={styles.btnCreate} onClick={openCreate}>
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

      {/* 다녀온 여행이 하나도 없으면 0만 가득한 타일이 첫 화면을 차지한다 — 숨긴다 */}
      {statsData && statsData.tripCount > 0 ? (
        <section className={styles.statsSection}>
          <StatsTiles stats={statsData} />
          <WorldMapCard countries={statsData.countries} />
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
            </div>
          )}

          {/* 커뮤니티에서 저장한 여행기 — 로그인한 사람만 */}
          {!guest && user ? <SavedTravelogues userId={user.id} /> : null}
        </div>

        <NextTripRail
          trip={nextTripDetail.data ?? nextTrip}
          members={nextTrip ? (members.data?.[nextTrip.id] ?? []) : []}
        />
      </div>

      {showLoginRequired ? <LoginRequiredDialog onClose={() => setShowLoginRequired(false)} /> : null}

      {guideOpen ? <FirstTripGuideDialog onSkip={() => answerGuide(false)} onOpenGuide={() => answerGuide(true)} /> : null}

      {(showCreate || (autoCreateCity && !guideOpen)) && (
        <CreateTripModal
          autoCreateCity={autoCreateCity}
          autoCreatePlaceId={autoCreatePlaceId}
          onClose={() => {
            setShowCreate(false);
            if (autoCreateCity) {
              searchParams.delete('autoCreate');
              searchParams.delete('placeId');
              setSearchParams(searchParams, { replace: true, preventScrollReset: true });
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

  // 임시 여행(이 기기에 저장)은 이름 변경·삭제가 되고, 복제만 로그인이 필요하다. 샘플은 전부 잠금
  const isDraft = isGuestTripId(trip.id);
  const lockedFor = (kind: 'rename' | 'duplicate' | 'delete') => !!actions.onLocked && !(isDraft && kind !== 'duplicate');
  const itemClassFor = (kind: 'rename' | 'duplicate' | 'delete') =>
    lockedFor(kind) ? `${styles.cardMenuItem} ${styles.cardMenuItemLocked}` : styles.cardMenuItem;
  // 삭제는 소유자만 된다(RLS) — 참여한 여행에서 누르면 아무 일도 안 일어나므로 나가기로 바꾼다
  const isMemberTrip = !!actions.currentUserId && !!actions.onLeave && trip.owner_id !== actions.currentUserId;
  /** 잠긴 메뉴(비로그인 샘플)면 동작 대신 로그인 안내 */
  function run(e: MouseEvent, kind: 'rename' | 'duplicate' | 'delete', action: () => void) {
    stop(e);
    setOpen(false);
    if (lockedFor(kind)) actions.onLocked?.();
    else action();
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
            className={itemClassFor('rename')}
            aria-disabled={lockedFor('rename') ? true : undefined}
            onClick={(e) =>
              run(e, 'rename', () => {
                const next = window.prompt(t('tripCard.renamePrompt'), trip.title);
                if (next && next.trim()) actions.onRename(trip.id, next.trim());
              })
            }
          >
            {t('tripCard.rename')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClassFor('duplicate')}
            aria-disabled={lockedFor('duplicate') ? true : undefined}
            onClick={(e) => run(e, 'duplicate', () => actions.onDuplicate(trip.id))}
          >
            {t('tripCard.duplicate')}
          </button>
          {isMemberTrip ? (
            <button
              type="button"
              role="menuitem"
              className={`${itemClassFor('delete')} ${styles.cardMenuDanger}`}
              onClick={(e) =>
                run(e, 'delete', () => {
                  if (window.confirm(t('collab.leaveConfirm', { title: trip.title }))) actions.onLeave?.(trip.id);
                })
              }
            >
              {t('collab.leave')}
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className={`${itemClassFor('delete')} ${styles.cardMenuDanger}`}
              aria-disabled={lockedFor('delete') ? true : undefined}
              onClick={(e) =>
                run(e, 'delete', () => {
                  if (window.confirm(t('tripCard.deleteConfirm', { title: trip.title }))) actions.onDelete(trip.id);
                })
              }
            >
              {t('common:action.delete')}
            </button>
          )}
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
  const { user } = useSession();
  const finalizeMutation = useFinalizeTrip(trip.id);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  // finalize_trip RPC는 소유자만 통과한다(0037) — 공유받은 여행엔 버튼을 안 보여준다
  const canFinalize = !trip.finalized_at && user?.id === trip.owner_id;

  async function handleFinalize() {
    try {
      await finalizeMutation.mutateAsync();
    } catch (err) {
      captureError(err, { context: 'finalizeTrip' });
      showToast(err instanceof Error ? err.message : t('tripDetail.loadError'));
    }
  }

  return (
    <>
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
              <span className={styles.travelersBadge}>
                {trip.id === SAMPLE_TRIP_ID
                  ? t('tripDetail.sampleBadge')
                  : isGuestTripId(trip.id)
                    ? t('tripDetail.draftBadge')
                    : t('desktop.travelers', { count: travelerCount })}
              </span>
              <TripMenu trip={trip} actions={actions} />
            </div>
          </div>
          <h3 className={styles.cardTitle}>{trip.title}</h3>
          <p className={styles.cardDesc}>{range ?? t('tripCard.periodUndecided')}</p>
          <div className={styles.cardRoute}>
            <Navigation size={14} color="var(--pd-accent)" aria-hidden="true" /> {cityDisplayName(trip.city) || t('desktop.cityUnset')}
            <TripWeatherChip trip={trip} className={styles.cardWeather} />
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
        {trip.finalized_at ? (
          <span className={`${styles.btnOpen} ${styles.btnFinalized}`}>{t('quota.finalizedBadge')}</span>
        ) : canFinalize ? (
          <button
            type="button"
            className={`${styles.btnOpen} ${isOngoing ? styles.btnOpenActive : ''}`}
            disabled={finalizeMutation.isPending}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirmFinalize(true);
            }}
          >
            {t('quota.finalizeButton')}
          </button>
        ) : null}
      </div>
    </Link>
    {confirmFinalize ? (
      <ConfirmDialog
        title={t('quota.finalizeButton')}
        message={t('quota.finalizeConfirm')}
        cancelLabel={t('quota.finalizeKeep')}
        confirmLabel={t('quota.finalizeProceed')}
        onConfirm={handleFinalize}
        onClose={() => setConfirmFinalize(false)}
      />
    ) : null}
    </>
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
            <span>{cityDisplayName(trip.city) || t('desktop.cityUnset')}</span>
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
function NextTripRail({ trip, members }: { trip: TripRow | null; members: TripMember[] }) {
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
            {hasNotStarted(trip) ? <DepartureChecklist trip={trip} /> : null}
            <PdfBox trip={trip} members={members} />
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
        <span className={styles.accentText}>{cityDisplayName(trip.city)}</span>
      </div>
      <div className={styles.weatherRow}>
        {icon ? (
          <span className={styles.weatherIcon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className={styles.toolkitValue}>
          {min ?? '–'} / {max ?? '–'}
        </span>
        {first.source === 'climate_normal' ? <span className={styles.weatherNormal}>{t('tripDetail.climateBadge')}</span> : null}
        {first.precipChance != null ? (
          <span className={styles.weatherPrecip}>{t('desktop.precip', { value: Math.round(first.precipChance * 100) })}</span>
        ) : null}
      </div>
    </div>
  );
}

/** 아직 출발 전(오늘 출발 포함) — 이미 떠난 여행에 항공권 찾기(지난 출발일)나 출발 전 체크리스트는 맞지 않는다 */
function hasNotStarted(trip: TripRow): boolean {
  return !trip.start_date || trip.start_date >= format(new Date(), 'yyyy-MM-dd');
}

/** 여행 도시·날짜로 항공 탭 검색을 바로 연다(출발지는 접속 위치) — flightsSearchLink.ts */
function FindFlightsButton({ trip, className }: { trip: TripRow; className?: string }) {
  const { t, i18n } = useTranslation('plan');
  const [busy, setBusy] = useState(false);
  // 마이리얼트립 결과 링크를 미리 받아 두면 누르는 순간 바로 열린다
  const prefetched = useTripFlightsLink(trip, i18n.language, true);
  return (
    <button
      type="button"
      className={className ?? styles.findFlightsBtn}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void openFlightsSearchForTrip(trip, i18n.language, prefetched).finally(() => setBusy(false));
      }}
    >
      <Search size={14} aria-hidden="true" /> {busy ? t('desktop.findFlightsBusy') : t('desktop.findFlights')}
    </button>
  );
}

function FlightBox({ trip }: { trip: TripRow }) {
  const { t } = useTranslation('plan');
  const flights = (tripService.toLocalProject(trip).flights ?? { outbound: null, return: null }) as FlightsData;
  const outbound = flights.outbound;

  if (!outbound) {
    return (
      <div className={styles.flightMissingBox}>
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
        {hasNotStarted(trip) ? <FindFlightsButton trip={trip} /> : null}
      </div>
    );
  }

  const route = [outbound.dep?.iata || outbound.dep?.name, outbound.arr?.iata || outbound.arr?.name].filter(Boolean).join(' → ');
  const times = [outbound.dep?.time, outbound.arr?.time].filter(Boolean).join(' → ');
  return (
    <div className={styles.toolkitAlert}>
      <Plane size={22} color="var(--pd-accent)" className={styles.flightIcon} aria-hidden="true" />
      <div>
        <div className={styles.flightNo}>{[flightAirlineLabel(outbound), outbound.flightNo].filter(Boolean).join(' ')}</div>
        <p className={styles.flightMeta}>
          {route}
          {times ? ` · ${times}` : ''}
        </p>
      </div>
    </div>
  );
}

function PdfBox({ trip, members }: { trip: TripRow; members: TripMember[] }) {
  const { t } = useTranslation('plan');
  const coverUrl = useCityImage(trip.city);
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
          city: cityDisplayName(trip.city),
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
          members: members.map((m) => m.name?.trim() ?? '').filter(Boolean),
          cityLat: trip.city_lat,
          cityLng: trip.city_lng,
          coverUrl,
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
