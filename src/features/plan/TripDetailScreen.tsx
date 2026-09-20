import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useTrip, useUpdateTripSnapshot } from './hooks/useTrips';
import { tripService, type LocalProject } from '@/shared/api/tripService';
import { DayChips } from './DayChips';
import { SortableItineraryItem } from './SortableItineraryItem';
import { LegLabel } from './LegLabel';
import { TripMapView } from './TripMapView';
import { AddPlaceModal } from './AddPlaceModal';
import { ItemDetailSheet } from './ItemDetailSheet';
import { SetHotelModal } from './SetHotelModal';
import { ShareSheet } from './ShareSheet';
import { MealsModal } from './MealsModal';
import { ExpenseModal } from './ExpenseModal';
import { formatItineraryText } from './formatItineraryText';
import { useTripRoutes } from './map/useTripRoutes';
import { getDayHotels, type Hotel } from './map/hotels';
import { syncMealItemsIntoDay } from './map/meals';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { trackScreenView } from '@/shared/monitoring';
import type {
  DayMeals,
  ExpenseItem,
  ExpensesData,
  HotelItem,
  HotelsData,
  MealsData,
  PlaceItem,
  PlannerData,
} from './types';
import styles from './TripDetailScreen.module.css';

/**
 * 여행 상세 화면 (02-screens.md §3.2) ⭐ 핵심 화면
 * 목록/지도 토글. 목록 모드에서도 useTripRoutes(map=null)로 구간 거리·시간을
 * 계산해 LegLabel에 채운다 — 실제 폴리라인 렌더링만 지도가 있을 때 일어난다.
 */
export function TripDetailScreen() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { data: trip, isLoading, isError, refetch } = useTrip(tripId);
  const updateSnapshot = useUpdateTripSnapshot(tripId);
  const [currentDay, setCurrentDay] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showHotelModal, setShowHotelModal] = useState(false);
  const [showMealsModal, setShowMealsModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    trackScreenView('trip_detail');
  }, []);

  const project = useMemo(() => (trip ? tripService.toLocalProject(trip) : null), [trip]);
  const hotelsData = useMemo(() => (project?.hotels ?? {}) as HotelsData, [project]);
  const mealsData = useMemo(() => (project?.meals ?? {}) as MealsData, [project]);
  const expensesData = useMemo(() => (project?.expenses ?? {}) as ExpensesData, [project]);
  const totalDays = project?.totalDays || 1;
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

  /** project.data[currentDay]를 갱신한 새 스냅샷을 저장한다 */
  async function persistDayItems(nextItems: PlaceItem[]) {
    if (!project || !trip) return;
    const plannerData = { ...((project.data ?? {}) as PlannerData) };
    plannerData[currentDay] = nextItems;
    const nextProject: LocalProject = { ...project, data: plannerData };
    await updateSnapshot.mutateAsync({ project: nextProject, name: trip.title });
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
  async function handleSetHotel(hotel: HotelItem | null) {
    if (!project || !trip) return;
    const nextHotels = { ...((project.hotels ?? {}) as HotelsData) };
    if (hotel) nextHotels[currentDay] = hotel;
    else delete nextHotels[currentDay];
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
    <div>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.backButton}
          aria-label="뒤로가기"
          onClick={() => navigate('/plan')}
        >
          ←
        </button>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>{trip.title}</h1>
          <p className={styles.dates}>
            {trip.start_date} ~ {trip.end_date}
          </p>
        </div>
        <button
          type="button"
          className={styles.toggleButton}
          aria-label={viewMode === 'list' ? '지도 보기' : '목록 보기'}
          onClick={() => setViewMode((v) => (v === 'list' ? 'map' : 'list'))}
        >
          {viewMode === 'list' ? '🗺' : '📋'}
        </button>
        <button type="button" className={styles.toggleButton} aria-label="공유" onClick={() => setShowShare(true)}>
          ↗
        </button>
      </div>

      <DayChips totalDays={totalDays} currentDay={currentDay} onChange={setCurrentDay} />

      <div className={styles.dayHeader}>
        <span>
          Day {currentDay}
          {trip.start_date ? ` · ${formatDayDate(trip.start_date, currentDay)}` : ''}
        </span>
        <div className={styles.dayHeaderActions}>
          <button type="button" className={styles.hotelButton} onClick={() => setShowHotelModal(true)}>
            🏨 {hotelsData[currentDay]?.name ?? '숙소'}
          </button>
          <button type="button" className={styles.hotelButton} onClick={() => setShowMealsModal(true)}>
            🍽 식사
          </button>
          <button type="button" className={styles.hotelButton} onClick={() => setShowExpenseModal(true)}>
            💰 경비
          </button>
        </div>
      </div>

      {viewMode === 'map' ? (
        <div className={styles.mapWrap}>
          <TripMapView
            dayItems={dayItems}
            startHotel={startHotel}
            endHotel={endHotel}
            activeZoneIndex={0}
          />
        </div>
      ) : (
        <TripTimeline
          dayItems={dayItems}
          startHotel={startHotel}
          endHotel={endHotel}
          onAddClick={() => setShowAddPlace(true)}
          onItemClick={setEditingIndex}
          onReorder={handleReorder}
        />
      )}

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
          currentHotel={hotelsData[currentDay] ?? null}
          onClose={() => setShowHotelModal(false)}
          onSave={handleSetHotel}
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
          currency={project?.currency ?? 'KRW'}
          expensesData={expensesData}
          onClose={() => setShowExpenseModal(false)}
          onSave={handleSaveExpenses}
        />
      ) : null}

      {showShare && tripId ? (
        <ShareSheet tripId={tripId} itineraryText={itineraryText} onClose={() => setShowShare(false)} />
      ) : null}
    </div>
  );
}

function formatDayDate(tripStartDate: string, dayIndex: number): string {
  const start = parseISO(tripStartDate);
  if (Number.isNaN(start.getTime())) return '';
  const date = new Date(start.getTime() + (dayIndex - 1) * 86_400_000);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'M/d (E)', { locale: ko });
}

interface TripTimelineProps {
  dayItems: PlaceItem[];
  startHotel: Hotel | null;
  endHotel: Hotel | null;
  onAddClick: () => void;
  onItemClick: (index: number) => void;
  onReorder: (nextItems: PlaceItem[]) => void;
}

function TripTimeline({
  dayItems,
  startHotel,
  endHotel,
  onAddClick,
  onItemClick,
  onReorder,
}: TripTimelineProps) {
  const legs = useTripRoutes({ map: null, dayItems, startHotel, endHotel, activeZoneIndex: 0 });
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

  return (
    <div className={styles.timeline}>
      {dayItems.length === 0 ? (
        <EmptyState icon="📍" message="이 날에는 아직 일정이 없어요." />
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            {dayItems.map((item, index) => (
              <div key={itemIds[index]}>
                <SortableItineraryItem
                  id={itemIds[index]}
                  index={index}
                  item={item}
                  onClick={() => onItemClick(index)}
                />
                {index < dayItems.length - 1 && legs[index] ? <LegLabel leg={legs[index]} /> : null}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      )}
      <div className={styles.addButtonWrap}>
        <button type="button" className={styles.addButton} onClick={onAddClick}>
          + 일정 추가
        </button>
      </div>
    </div>
  );
}
