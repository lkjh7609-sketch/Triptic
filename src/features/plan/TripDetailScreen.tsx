import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { addDays, format, parseISO } from 'date-fns';
import { formatLocalizedDay } from './planDateFormat';
import { useWeather, type WeatherDailyEntry } from '@/features/weather/useWeather';
import { mapConditionCode, weatherIcon } from '@/features/weather/conditionMap';
import { formatTemp } from '@/features/weather/weatherRules';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useTrip, useUpdateTripSnapshot, useSuggestions } from './hooks/useTrips';
import { tripService, type LocalProject, type Suggestion } from '@/shared/api/tripService';
import { SAMPLE_TRIP_ID } from './sampleTrip';
import { DayChips } from './DayChips';
import { SortableItineraryItem } from './SortableItineraryItem';
import { TripMapView } from './TripMapView';
import { AddPlaceModal } from './AddPlaceModal';
import { ItemDetailSheet } from './ItemDetailSheet';
import { SetHotelModal } from './SetHotelModal';
import { ShareSheet } from './ShareSheet';
import { MealsModal } from './MealsModal';
import { ExpenseModal } from './ExpenseModal';
import { FlightModal } from './FlightModal';
import { DayCityModal } from './DayCityModal';
import { SuggestionsModal } from './SuggestionsModal';
import { UploadModal } from '@/features/documents/UploadModal';
import { ReviewSheet } from '@/features/documents/ReviewSheet';
import { VoucherArchive } from '@/features/documents/VoucherArchive';
import { usePendingBookings } from '@/features/documents/useDocuments';
import type { ParseBookingResponse } from '@/features/documents/documentService';
import { formatItineraryText } from './formatItineraryText';
import { useTripRoutes, type RouteLeg, type RouteWaypoint } from './map/useTripRoutes';
import { getDayHotels, type Hotel } from './map/hotels';
import { syncMealItemsIntoDay } from './map/meals';
import { getDayCity } from './dayCities';
import { FixedPointCard, FlightPointCard, LegBetween } from './FixedPointCard';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { FloatingMapInspector } from './FloatingMapInspector';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import { useCityImage } from '@/shared/hooks/useCityImage';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type {
  DayCitiesData,
  DayCityInfo,
  DayMeals,
  ExpenseItem,
  ExpensesData,
  FlightInfo,
  FlightsData,

  HotelsData,
  MealsData,
  PlaceItem,
  PlannerData,
} from './types';
import styles from './TripDetailScreen.module.css';
import { AiNextPlaceModal } from './AiNextPlaceModal';
import { Lightbulb, Ticket, ExternalLink, MapPin, Hotel as HotelIcon, Utensils, Coins, Plane, FileText, Map, List } from 'lucide-react';

/**
 * 여행 상세 화면 (02-screens.md §3.2) ⭐ 핵심 화면
 * 목록/지도 토글. 목록 모드에서도 useTripRoutes(map=null)로 구간 거리·시간을
 * 계산해 LegLabel에 채운다 — 실제 폴리라인 렌더링만 지도가 있을 때 일어난다.
 */
export function TripDetailScreen() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { t, i18n } = useTranslation(['plan', 'common']);
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const isSample = tripId === SAMPLE_TRIP_ID;
  const { data: trip, isLoading, isError, refetch } = useTrip(tripId);
  const updateSnapshot = useUpdateTripSnapshot(tripId);
  const { data: suggestions } = useSuggestions(tripId);
  const [currentDay, setCurrentDay] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const bgImage = useCityImage(trip?.city ?? '');
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<{index: number, type: "item" | "startHotel" | "endHotel"} | null>(null);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [showMealsModal, setShowMealsModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showFlightModal, setShowFlightModal] = useState(false);
  const [showDayCityModal, setShowDayCityModal] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggestBase, setAiSuggestBase] = useState<{ index: number, item: PlaceItem } | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [showVoucherArchive, setShowVoucherArchive] = useState(false);
  const pendingBookings = usePendingBookings(isSample ? undefined : tripId);

  useEffect(() => {
    trackScreenView('trip_detail');
  }, []);

  const project = useMemo(() => (trip ? tripService.toLocalProject(trip) : null), [trip]);
  const hotelsData = useMemo(() => (project?.hotels ?? {}) as HotelsData, [project]);
  const mealsData = useMemo(() => (project?.meals ?? {}) as MealsData, [project]);
  const expensesData = useMemo(() => (project?.expenses ?? {}) as ExpensesData, [project]);
  const flightsData = useMemo(
    () => (project?.flights ?? { outbound: null, return: null }) as FlightsData,
    [project],
  );
  const dayCitiesData = useMemo(() => (project?.dayCities ?? {}) as DayCitiesData, [project]);
  const totalDays = project?.totalDays || 1;
  const currentCity = getDayCity(currentDay, dayCitiesData, {
    name: project?.city ?? null,
    lat: project?.cityLat ?? null,
    lng: project?.cityLng ?? null,
  });
  /** 여행 단위로 한 번만 묶어서 조회한다(05-weather.md §3.1) — 같은 도시로 날짜만
   * 바꿔가며 봐도 TanStack Query 캐시가 같아 네트워크 호출이 늘지 않는다. */
  const weather = useWeather(currentCity.lat, currentCity.lng, trip?.start_date, trip?.end_date);
  const dayDateISO = trip?.start_date
    ? format(addDays(parseISO(trip.start_date), currentDay - 1), 'yyyy-MM-dd')
    : null;
  const dayWeather = dayDateISO ? weather.data?.daily.find((d) => d.date === dayDateISO) : undefined;
  const isFirstDay = currentDay === 1;
  const isLastDay = currentDay === totalDays;
  /** 첫날 도착 지점/마지막날 출발 지점으로만 표시된다 (index.html renderList flightArrivalPoint/flightDeparturePoint) */
  const flightArrival =
    isFirstDay && flightsData.outbound?.arr.lat != null && flightsData.outbound.arr.lng != null
      ? flightsData.outbound
      : null;
  const flightDeparture =
    isLastDay && flightsData.return?.dep.lat != null && flightsData.return.dep.lng != null
      ? flightsData.return
      : null;
  const dayItems: PlaceItem[] = useMemo(() => {
    const plannerData = (project?.data ?? {}) as PlannerData;
    return plannerData[currentDay] ?? [];
  }, [project, currentDay]);
  const { startHotel, endHotel } = getDayHotels(currentDay, totalDays, hotelsData);
  const itineraryText = useMemo(() => {
    if (!project || !trip) return undefined;
    return formatItineraryText({
      title: trip.title,
      city: trip.city,
      startDate: trip.start_date,
      endDate: trip.end_date,
      totalDays,
      plannerData: (project.data ?? {}) as PlannerData,
      hotelsData,
    });
  }, [project, trip, totalDays, hotelsData]);
  const pdfInput = useMemo(() => {
    if (!project || !trip) return undefined;
    return {
      title: trip.title,
      city: trip.city ?? '',
      startDate: trip.start_date ?? '',
      endDate: trip.end_date ?? '',
      totalDays,
      currency: project.currency ?? 'KRW',
      currentDay,
      plannerData: (project.data ?? {}) as PlannerData,
      hotelsData,
      flightsData,
      expensesData,
      dayCitiesData,
    };
  }, [project, trip, totalDays, currentDay, hotelsData, flightsData, expensesData, dayCitiesData]);

  /** project.data[currentDay]를 갱신한 새 스냅샷을 저장한다 */
  async function persistDayItems(nextItems: PlaceItem[]) {
    if (!project || !trip) return;
    const plannerData = { ...((project.data ?? {}) as PlannerData) };
    plannerData[currentDay] = nextItems;
    const nextProject: LocalProject = { ...project, data: plannerData };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
  }

  async function handleInsertPlace(item: PlaceItem, insertIndex: number) {
    try {
      const next = [...dayItems];
      next.splice(insertIndex + 1, 0, item);
      await persistDayItems(next);
    } catch (err) {
      captureError(err, { context: "insertPlace" });
    }
  }

  async function handleAddPlace(item: PlaceItem) {
    await persistDayItems([...dayItems, item]);
  }

  async function handleUpdateItem(index: number, patch: Partial<PlaceItem>) {
    const next = dayItems.map((it, i) => (i === index ? { ...it, ...patch } : it));
    await persistDayItems(next);
  }

  async function handleDeleteItem(index: number) {
    await persistDayItems(dayItems.filter((_, i) => i !== index));
  }

  /** 드래그 순서 변경 (DEVELOPMENT_PLAN.md §9 Phase 2: dnd-kit) */
  async function handleReorder(nextItems: PlaceItem[]) {
    await persistDayItems(nextItems);
  }

  /** 항목을 다른 날짜로 옮긴다 — 두 날짜를 한 스냅샷 안에서 함께 갱신한다 */
  async function handleMoveItem(index: number, targetDay: number) {
    if (!project || !trip) return;
    const item = dayItems[index];
    if (!item) return;
    const plannerData = { ...((project.data ?? {}) as PlannerData) };
    plannerData[currentDay] = dayItems.filter((_, i) => i !== index);
    plannerData[targetDay] = [...(plannerData[targetDay] ?? []), item];
    const nextProject: LocalProject = { ...project, data: plannerData };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
  }

  /** 이 날짜의 숙소를 갱신한다 (hotelsData[currentDay], index.html clearHotel/renderHotelSection 이식) */
  async function handleSetAllHotels(nextHotels: HotelsData) {
    if (!project || !trip) return;
    const nextProject: LocalProject = { ...project, hotels: nextHotels };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
  }

  /** 식사 슬롯 저장 — mealsData와 plannerData(식사 항목)를 한 스냅샷으로 함께 갱신한다
   * (index.html selectMeal/toggleMealSkip → saveData가 mealsData/plannerData를 같이
   * 저장하던 것과 동일한 시점 보장) */
  async function handleSaveMeals(dayMeals: DayMeals) {
    if (!project || !trip) return;
    const nextMeals = { ...((project.meals ?? {}) as MealsData), [currentDay]: dayMeals };
    const plannerData = { ...((project.data ?? {}) as PlannerData) };
    plannerData[currentDay] = syncMealItemsIntoDay(dayItems, dayMeals);
    const nextProject: LocalProject = { ...project, meals: nextMeals, data: plannerData };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
  }

  /** 경비 저장 (index.html addExpense/deleteExpense 이식) */
  async function handleSaveExpenses(dayExpenses: ExpenseItem[]) {
    if (!project || !trip) return;
    const nextExpenses = { ...((project.expenses ?? {}) as ExpensesData), [currentDay]: dayExpenses };
    const nextProject: LocalProject = { ...project, expenses: nextExpenses };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
  }

  /** 항공편 저장 (index.html lookupFlightForModal/saveManualFlight 이식) */
  async function handleSaveFlights(nextFlights: FlightsData) {
    if (!project || !trip) return;
    const nextProject: LocalProject = { ...project, flights: nextFlights };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
  }

  /** 일차별 도시 변경 (index.html submitDayCityChange 이식) */
  async function handleSaveDayCity(city: DayCityInfo, scope: 'rest' | 'single') {
    if (!project || !trip) return;
    const nextDayCities = { ...dayCitiesData };
    if (scope === 'rest') {
      for (let d = currentDay; d <= totalDays; d++) nextDayCities[d] = city;
    } else {
      nextDayCities[currentDay] = city;
    }
    const nextProject: LocalProject = { ...project, dayCities: nextDayCities };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
  }

  /** 동행자 제안 수락 — 해당 일차 맨 뒤에 추가한다 (index.html acceptSuggestion 이식) */
  async function handleAcceptSuggestion(s: Suggestion) {
    if (!project || !trip) return;
    const plannerData = { ...((project.data ?? {}) as PlannerData) };
    const dayList = plannerData[s.day] ?? [];
    const validList = dayList.filter(Boolean);
    const defaultTime = validList.length > 0 ? validList[validList.length - 1].time || '10:00' : '10:00';
    let memo = s.proposer ? `[${s.proposer}님 추천] ` : '';
    if (s.memo) memo += s.memo;
    plannerData[s.day] = [
      ...dayList,
      { name: s.name, address: s.address ?? '', lat: s.lat ?? 0, lng: s.lng ?? 0, time: defaultTime, memo },
    ];
    const nextProject: LocalProject = { ...project, data: plannerData };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
    setCurrentDay(s.day);
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="24px" width="60%" />
        <div style={{ height: 12 }} />
        <Skeleton height="88px" />
      </div>
    );
  }

  if (isError || !trip) {
    return <ErrorState summary="여행을 불러오지 못했어요." onRetry={() => refetch()} />;
  }


  return (
    <>
    <div className={isDesktop ? styles.desktopContainer : undefined}>
      {isDesktop && (
        <div className={styles.desktopMapLeft}>
          <TripMapView
            dayItems={dayItems}
            startHotel={startHotel}
            endHotel={endHotel}
            activeZoneIndex={0}
            cityLocation={currentCity.lat != null && currentCity.lng != null ? { lat: currentCity.lat, lng: currentCity.lng } : null}
            onMarkerClick={(index, type) => setSelectedMarker({ index, type })}
          />
          {(() => {
            const item = selectedMarker?.type === 'item' ? dayItems[selectedMarker.index] 
              : selectedMarker?.type === 'startHotel' ? startHotel 
              : selectedMarker?.type === 'endHotel' ? endHotel 
              : dayItems.length > 0 ? dayItems[0] : null;
              
            if (!item) return null;
            return (
              <FloatingMapInspector 
                title={item.name || '선택된 장소'}
                subtitle={'address' in item ? item.address || '주소 정보가 없습니다' : '주소 정보가 없습니다'}
                image={bgImage}
                recommendation="오전 9시 방문 추천"
                crowdLevel="low"
                onFocusMove={() => {
                  if (selectedMarker?.type === 'item' || !selectedMarker) {
                    const idx = selectedMarker?.index ?? 0;
                    const listContainer = document.querySelector(`.${styles.desktopListRight}`);
                    const elements = listContainer?.querySelectorAll('[data-timeline-item]');
                    if (elements && elements[idx]) {
                      elements[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
                      // highlight the item briefly if possible
                      (elements[idx] as HTMLElement).style.backgroundColor = 'var(--surface-sunken)';
                      setTimeout(() => {
                        (elements[idx] as HTMLElement).style.backgroundColor = '';
                      }, 1000);
                    }
                  }
                }}
              />
            );
          })()}
        </div>
      )}
      <div className={isDesktop ? styles.desktopListRight : undefined}>
        <div className={styles.heroHeader} style={{ backgroundImage: `linear-gradient(to top, var(--surface-page) 0%, rgba(0,0,0,0.5) 100%), url('${bgImage}')` }}>
          <button
            type="button"
            className={styles.backButton}
            aria-label={t('tripDetail.backAria')}
            onClick={() => navigate('/plan')}
          >
            ←
          </button>
          <div className={styles.headerInfo}>
            <h1 className={styles.title}>
              {trip.title}
              {isSample ? <span className={styles.sampleBadge}>{t('tripDetail.sampleBadge')}</span> : null}
            </h1>
            <p className={styles.dates}>
              {trip.start_date} ~ {trip.end_date}
            </p>
          </div>
        </div>
        <div className={styles.toolbar}>
          {!isDesktop && (
            <button
              type="button"
              className={styles.toggleButton}
              aria-label={viewMode === 'list' ? t('tripDetail.mapViewAria') : t('tripDetail.listViewAria')}
              onClick={() => setViewMode((v) => (v === 'list' ? 'map' : 'list'))}
            >
              {viewMode === 'list' ? <Map size={18} /> : <List size={18} />}
            </button>
          )}
          {!isSample ? (
            <button
              type="button"
              className={styles.toggleButton}
              aria-label={t('flight.title')}
              onClick={() => setShowFlightModal(true)}
            >
              <Plane size={18} />
            </button>
          ) : null}
          {!isSample ? (
            <button
              type="button"
              className={styles.toggleButton}
              aria-label={t('tripDetail.addByDocument')}
              onClick={() =>
                (pendingBookings.data?.length ?? 0) > 0 ? setShowReviewSheet(true) : setShowUploadModal(true)
              }
            >
              <FileText size={18} />
              {(pendingBookings.data?.length ?? 0) > 0 ? (
                <span className={styles.badge}>{pendingBookings.data!.length}</span>
              ) : null}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.toggleButton}
            aria-label={t('tripDetail.suggestionsAria')}
            onClick={() => setShowSuggestions(true)}
            disabled={isSample}
            title={isSample ? t('tripDetail.suggestionsSampleTitle') : undefined}
          >
            <Lightbulb size={18} />{(suggestions?.length ?? 0) > 0 ? <span className={styles.badge}>{suggestions!.length}</span> : null}
          </button>
          {!isSample ? (
            <button
              type="button"
              className={styles.toggleButton}
              aria-label={t('tripDetail.voucherAria')}
              onClick={() => setShowVoucherArchive(true)}
            >
              <Ticket size={18} />
              {(pendingBookings.data?.length ?? 0) > 0 ? (
                <span className={styles.badge}>{pendingBookings.data!.length}</span>
              ) : null}
            </button>
          ) : null}
          <button type="button" className={styles.toggleButton} aria-label={t('tripDetail.shareAria')} onClick={() => setShowShare(true)}>
            <ExternalLink size={18} />
          </button>
        </div>

        <DayChips totalDays={totalDays} currentDay={currentDay} onChange={setCurrentDay} />

        <div className={styles.dayHeader}>
          <div className={styles.dayHeaderTopRow}>
            <span className={styles.dayHeaderTitle}>
              Day {currentDay}
              {trip.start_date ? ` · ${formatDayDate(trip.start_date, currentDay, i18n.language)}` : ''}
              <DayWeatherBadge loading={weather.isLoading} entry={dayWeather} />
            </span>

          </div>
          <div className={styles.dayHeaderActions}>
            <button type="button" className={styles.hotelButton} onClick={() => setShowDayCityModal(true)}>
              <MapPin size={16} /> <span className={styles.buttonText}>{currentCity.name ? currentCity.name.split(',')[0].trim() : t('tripDetail.cityUnset')}</span>
            </button>
            {currentDay < totalDays ? (<button type="button" className={styles.hotelButton} onClick={() => setShowHotelModal(true)}>
              <HotelIcon size={16} /> <span className={styles.buttonText}>{hotelsData[currentDay]?.name ?? t('tripDetail.hotelUnset')}</span>
            </button>) : null}
            <button type="button" className={styles.hotelButton} onClick={() => setShowMealsModal(true)}>
              <Utensils size={16} /> <span className={styles.buttonText}>{t('tripDetail.mealsLabel')}</span>
            </button>
            <button type="button" className={styles.hotelButton} onClick={() => setShowExpenseModal(true)}>
              <Coins size={16} /> <span className={styles.buttonText}>{t('tripDetail.expenseLabel')}</span>
            </button>

          </div>
        </div>

        {!isDesktop && viewMode === 'map' ? (
          <div className={styles.mapWrap}>
            <TripMapView
            dayItems={dayItems}
            startHotel={startHotel}
            endHotel={endHotel}
            activeZoneIndex={0}
            cityLocation={currentCity.lat != null && currentCity.lng != null ? { lat: currentCity.lat, lng: currentCity.lng } : null}
            onMarkerClick={(index, type) => setSelectedMarker({ index, type })}
          />
          </div>
        ) : (
          <TripTimeline
            dayItems={dayItems}
            startHotel={startHotel}
            endHotel={endHotel}
            flightArrival={flightArrival}
            flightDeparture={flightDeparture}
            onAddClick={() => setShowAddPlace(true)}
          onItemClick={setEditingIndex}
          onReorder={handleReorder}
          onAiSuggest={() => setAiSuggestBase({ index: dayItems.length - 1, item: dayItems[dayItems.length - 1] })}
          onAiSuggestItem={(index, item) => setAiSuggestBase({ index, item })}
        />
      )}
      </div>
    </div>

      {aiSuggestBase !== null ? (
        <AiNextPlaceModal
          trip={trip}
          currentDay={currentDay}
          baseItem={aiSuggestBase.item}
          insertIndex={aiSuggestBase.index}
          onClose={() => setAiSuggestBase(null)}
          onAddPlace={(item) => handleInsertPlace(item, aiSuggestBase.index)}
        />
      ) : null}

      {showAddPlace ? (
        <AddPlaceModal onClose={() => setShowAddPlace(false)} onAdd={handleAddPlace} />
      ) : null}

      {editingIndex !== null && dayItems[editingIndex] ? (
        <ItemDetailSheet
          item={dayItems[editingIndex]}
          currentDay={currentDay}
          totalDays={totalDays}
          onClose={() => setEditingIndex(null)}
          onSave={(patch) => handleUpdateItem(editingIndex, patch)}
          onDelete={() => handleDeleteItem(editingIndex)}
          onMoveToDay={(targetDay) => handleMoveItem(editingIndex, targetDay)}
        />
      ) : null}

      {showHotelModal ? (
        <SetHotelModal
          currentDay={currentDay}
          totalDays={totalDays}
          hotelsData={hotelsData}
          onClose={() => setShowHotelModal(false)}
          onSave={handleSetAllHotels}
        />
      ) : null}

      {showMealsModal ? (
        <MealsModal
          dayMeals={mealsData[currentDay] ?? {}}
          onClose={() => setShowMealsModal(false)}
          onSave={handleSaveMeals}
        />
      ) : null}

      {showExpenseModal ? (
        <ExpenseModal
          currentDay={currentDay}
          totalDays={totalDays}
          currency={project?.currency ?? 'KRW'}
          expensesData={expensesData}
          onClose={() => setShowExpenseModal(false)}
          onSave={handleSaveExpenses}
        />
      ) : null}

      {showDayCityModal ? (
        <DayCityModal
          currentDay={currentDay}
          totalDays={totalDays}
          currentCity={currentCity}
          onClose={() => setShowDayCityModal(false)}
          onSave={handleSaveDayCity}
        />
      ) : null}

      {showFlightModal && trip ? (
        <FlightModal
          flightsData={flightsData}
          onClose={() => setShowFlightModal(false)}
          onSave={handleSaveFlights}
        />
      ) : null}

      {showSuggestions && tripId ? (
        <SuggestionsModal
          tripId={tripId}
          suggestions={suggestions ?? []}
          onClose={() => setShowSuggestions(false)}
          onAccept={handleAcceptSuggestion}
        />
      ) : null}

      {showShare && tripId ? (
        <ShareSheet
          tripId={tripId}
          itineraryText={itineraryText}
          pdfInput={pdfInput}
          isSample={isSample}
          onClose={() => setShowShare(false)}
        />
      ) : null}

      {showUploadModal && tripId ? (
        <UploadModal
          tripId={tripId}
          onClose={() => setShowUploadModal(false)}
          onParsed={(result: ParseBookingResponse) => {
            setShowUploadModal(false);
            if (result.bookings.length > 0) setShowReviewSheet(true);
          }}
        />
      ) : null}

      {showReviewSheet && tripId && trip ? (
        <ReviewSheet
          tripId={tripId}
          bookings={pendingBookings.data ?? []}
          tripStartDate={trip.start_date ?? ''}
          tripEndDate={trip.end_date ?? ''}
          flightsData={flightsData}
          onCommitFlight={handleSaveFlights}
          onClose={() => setShowReviewSheet(false)}
        />
      ) : null}

      {showVoucherArchive && tripId ? (
        <VoucherArchive tripId={tripId} onClose={() => setShowVoucherArchive(false)} />
      ) : null}
    </>
  );
}

function formatDayDate(tripStartDate: string, dayIndex: number, language: string): string {
  const start = parseISO(tripStartDate);
  if (Number.isNaN(start.getTime())) return '';
  const date = new Date(start.getTime() + (dayIndex - 1) * 86_400_000);
  if (Number.isNaN(date.getTime())) return '';
  return formatLocalizedDay(date, language);
}

interface DayWeatherBadgeProps {
  loading: boolean;
  entry: WeatherDailyEntry | undefined;
}

/**
 * 일자 헤더 최고/최저 기온 (05-weather.md §6.1 "Day 1  5/20(수)  ☀️ 16°/23°").
 * 로딩 중엔 스켈레톤, 실패/데이터없음이면 아무것도 렌더링하지 않는다(§6.3) —
 * 0°/--° 같은 가짜 값을 채우지 않는다. 평년값(예보 10일 초과)은 "평년" 배지로
 * 구분한다(§5.1 "평년값을 예보처럼 보여주면 안 된다").
 */
function DayWeatherBadge({ loading, entry }: DayWeatherBadgeProps) {
  const { t } = useTranslation(['plan', 'common']);
  const tempUnit = useTempUnit();
  if (loading) return <span className={styles.weatherSkeleton} aria-hidden="true" />;
  if (!entry) return null;
  const min = formatTemp(entry.tempMinC, tempUnit);
  const max = formatTemp(entry.tempMaxC, tempUnit);
  if (min == null && max == null) return null;
  const icon = entry.conditionCode ? weatherIcon(mapConditionCode(entry.conditionCode), true) : null;
  return (
    <span className={styles.dayWeather}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {min ?? '–'}/{max ?? '–'}
      {entry.source === 'climate_normal' ? <span className={styles.climateBadge}>{t('tripDetail.climateBadge')}</span> : null}
    </span>
  );
}

interface TripTimelineProps {
  onAiSuggestItem: (index: number, item: PlaceItem) => void;
  onAiSuggest?: () => void;
  dayItems: PlaceItem[];
  startHotel: Hotel | null;
  endHotel: Hotel | null;
  /** 첫날에만 있을 수 있는 항공편 도착 지점 (index.html flightArrivalPoint) */
  flightArrival: FlightInfo | null;
  /** 마지막날에만 있을 수 있는 항공편 출발 지점 (index.html flightDeparturePoint) */
  flightDeparture: FlightInfo | null;
  onAddClick: () => void;
  onItemClick: (index: number) => void;
  onReorder: (nextItems: PlaceItem[]) => void;
}

/**
 * 여정 순서: [항공편 도착] → [출발 숙소] → 일정 항목들 → [복귀 숙소] → [항공편 출발]
 * (index.html renderList의 sequence 배열과 동일한 순서 — ADR-001). 고정 지점
 * (숙소·항공편)은 드래그 대상이 아니므로 SortableContext 밖에서 렌더링하고,
 * 일정 항목 사이 구간만 dnd-kit로 순서를 바꿀 수 있다.
 */
function TripTimeline({
  onAiSuggestItem,

  dayItems,
  startHotel,
  endHotel,
  flightArrival,
  flightDeparture,
  onAddClick,
  onItemClick,
  onReorder,
}: TripTimelineProps) {
  const { t } = useTranslation(['plan', 'common']);
  // useTripRoutes의 effect 의존성 배열에 들어가는 객체다 — 매 렌더마다 새 리터럴을
  // 넘기면 참조가 달라져 effect가 끝없이 재실행되고(각 실행이 setLegs로 다시
  // 렌더를 유발) 무한 루프에 빠진다. flightArrival/flightDeparture(FlightInfo)
  // 자체는 flightsData가 useMemo로 안정된 참조라 여기서도 useMemo로 감싸면
  // 같은 편도가 유지되는 한 참조가 고정된다.
  const flightArrivalPoint = useMemo(
    () =>
      flightArrival && flightArrival.arr.lat != null && flightArrival.arr.lng != null
        ? { lat: flightArrival.arr.lat, lng: flightArrival.arr.lng }
        : null,
    [flightArrival],
  );
  const flightDeparturePoint = useMemo(
    () =>
      flightDeparture && flightDeparture.dep.lat != null && flightDeparture.dep.lng != null
        ? { lat: flightDeparture.dep.lat, lng: flightDeparture.dep.lng }
        : null,
    [flightDeparture],
  );
  const legs = useTripRoutes({
    map: null,
    dayItems,
    startHotel,
    endHotel,
    activeZoneIndex: 0,
    flightArrival: flightArrivalPoint,
    flightDeparture: flightDeparturePoint,
  });
  // 드래그 인터랙션 동안만 안정적이면 충분하다 — key가 없는 레거시 항목은
  // "그 순간의 index" 기반으로 식별한다 (types.ts PlaceItem.key 주석 참고).
  const itemIds = dayItems.map((item, i) => item.key ?? `idx-${i}`);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(dayItems, oldIndex, newIndex));
  }

  // 시퀀스 순서대로 ref를 나열해, 각 지점 "바로 다음" 구간의 leg를 정확히 찾는다
  // (legs 배열 인덱스를 dayItems 인덱스와 직접 맞추면 startHotel/항공편이 있을 때
  // 어긋난다 — RouteWaypoint.ref로 매칭해야 한다).
  const refs: RouteWaypoint['ref'][] = [];
  if (flightArrival) refs.push('flight-arrival');
  if (startHotel) refs.push('start-hotel');
  dayItems.forEach((_, i) => refs.push(i));
  if (endHotel) refs.push('end-hotel');
  if (flightDeparture) refs.push('flight-departure');

  function legAfter(ref: RouteWaypoint['ref']): RouteLeg | undefined {
    const idx = refs.indexOf(ref);
    if (idx === -1 || idx === refs.length - 1) return undefined;
    const nextRef = refs[idx + 1];
    return legs.find((l) => l.from.ref === ref && l.to.ref === nextRef);
  }

  const isEmpty = dayItems.length === 0 && !startHotel && !endHotel && !flightArrival && !flightDeparture;

  return (
    <div className={styles.timeline}>
      {isEmpty ? (
        <EmptyState icon={<MapPin size={48} />} message={t('tripDetail.emptyDay')} />
      ) : (
        <>
          {flightArrival ? (
            <>
              <FlightPointCard flight={flightArrival} />
              <LegBetween leg={legAfter('flight-arrival')} />
            </>
          ) : null}

          {startHotel ? (
            <>
              <FixedPointCard icon={<HotelIcon size={18} />} label={t('tripDetail.hotelStart')} name={startHotel.name} address={startHotel.address} />
              <LegBetween leg={legAfter('start-hotel')} />
            </>
          ) : null}

          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {dayItems.map((item, index) => (
                <div key={itemIds[index]} data-timeline-item={index}>
                  <SortableItineraryItem
                    id={itemIds[index]}
                    index={index}
                    item={item}
                    onClick={() => onItemClick(index)}
            onAiSuggest={() => onAiSuggestItem(index, item)}
                  />
                  <LegBetween leg={legAfter(index)} />
                </div>
              ))}
            </SortableContext>
          </DndContext>

          {endHotel ? (
            <FixedPointCard icon={<HotelIcon size={18} />} label={t('tripDetail.hotelEnd')} name={endHotel.name} address={endHotel.address} />
          ) : null}

          {flightDeparture ? <FlightPointCard flight={flightDeparture} /> : null}
        </>
      )}
      <div className={styles.addButtonWrap}>
        <button type="button" className={styles.addButton} onClick={onAddClick}>
          + {t('tripDetail.addPlace')}
        </button>
      </div>
    </div>
  );
}

