import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTrip, useUpdateTripSnapshot } from './hooks/useTrips';
import { tripService, type LocalProject } from '@/shared/api/tripService';
import { DayChips } from './DayChips';
import { ItineraryItemCard } from './ItineraryItemCard';
import { LegLabel } from './LegLabel';
import { TripMapView } from './TripMapView';
import { AddPlaceModal } from './AddPlaceModal';
import { ItemDetailSheet } from './ItemDetailSheet';
import { useTripRoutes } from './map/useTripRoutes';
import { getDayHotels, type Hotel } from './map/hotels';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { trackScreenView } from '@/shared/monitoring';
import type { HotelsData, PlaceItem, PlannerData } from './types';
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

  useEffect(() => {
    trackScreenView('trip_detail');
  }, []);

  const project = useMemo(() => (trip ? tripService.toLocalProject(trip) : null), [trip]);
  const hotelsData = (project?.hotels ?? {}) as HotelsData;
  const totalDays = project?.totalDays || 1;
  const dayItems: PlaceItem[] = useMemo(() => {
    const plannerData = (project?.data ?? {}) as PlannerData;
    return plannerData[currentDay] ?? [];
  }, [project, currentDay]);
  const { startHotel, endHotel } = getDayHotels(currentDay, totalDays, hotelsData);

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
      </div>

      <DayChips totalDays={totalDays} currentDay={currentDay} onChange={setCurrentDay} />

      <div className={styles.dayHeader}>
        <span>
          Day {currentDay}
          {trip.start_date ? ` · ${formatDayDate(trip.start_date, currentDay)}` : ''}
        </span>
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
        />
      )}

      {showAddPlace ? (
        <AddPlaceModal onClose={() => setShowAddPlace(false)} onAdd={handleAddPlace} />
      ) : null}

      {editingIndex !== null && dayItems[editingIndex] ? (
        <ItemDetailSheet
          item={dayItems[editingIndex]}
          onClose={() => setEditingIndex(null)}
          onSave={(patch) => handleUpdateItem(editingIndex, patch)}
          onDelete={() => handleDeleteItem(editingIndex)}
        />
      ) : null}
    </div>
  );
}

function formatDayDate(tripStartDate: string, dayIndex: number): string {
  const date = new Date(parseISO(tripStartDate).getTime() + (dayIndex - 1) * 86_400_000);
  return format(date, 'M/d (E)', { locale: ko });
}

interface TripTimelineProps {
  dayItems: PlaceItem[];
  startHotel: Hotel | null;
  endHotel: Hotel | null;
  onAddClick: () => void;
  onItemClick: (index: number) => void;
}

function TripTimeline({ dayItems, startHotel, endHotel, onAddClick, onItemClick }: TripTimelineProps) {
  const legs = useTripRoutes({ map: null, dayItems, startHotel, endHotel, activeZoneIndex: 0 });

  return (
    <div className={styles.timeline}>
      {dayItems.length === 0 ? (
        <EmptyState icon="📍" message="이 날에는 아직 일정이 없어요." />
      ) : (
        dayItems.map((item, index) => (
          <div key={`${item.name}-${index}`}>
            <ItineraryItemCard index={index} item={item} onClick={() => onItemClick(index)} />
            {index < dayItems.length - 1 && legs[index] ? <LegLabel leg={legs[index]} /> : null}
          </div>
        ))
      )}
      <div className={styles.addButtonWrap}>
        <button type="button" className={styles.addButton} onClick={onAddClick}>
          + 일정 추가
        </button>
      </div>
    </div>
  );
}
