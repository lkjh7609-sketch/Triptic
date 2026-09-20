import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTrip } from './hooks/useTrips';
import { tripService } from '@/shared/api/tripService';
import { DayChips } from './DayChips';
import { ItineraryItemCard } from './ItineraryItemCard';
import { LegLabel } from './LegLabel';
import { TripMapView } from './TripMapView';
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
  const [currentDay, setCurrentDay] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

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
        <TripTimeline dayItems={dayItems} startHotel={startHotel} endHotel={endHotel} />
      )}
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
}

function TripTimeline({ dayItems, startHotel, endHotel }: TripTimelineProps) {
  const legs = useTripRoutes({ map: null, dayItems, startHotel, endHotel, activeZoneIndex: 0 });

  if (dayItems.length === 0) {
    return <EmptyState icon="📍" message="이 날에는 아직 일정이 없어요." />;
  }

  return (
    <div className={styles.timeline}>
      {dayItems.map((item, index) => (
        <div key={`${item.name}-${index}`}>
          <ItineraryItemCard index={index} item={item} />
          {index < dayItems.length - 1 && legs[index] ? <LegLabel leg={legs[index]} /> : null}
        </div>
      ))}
      <div className={styles.addButtonWrap}>
        <button type="button" className={styles.addButton} disabled>
          + 일정 추가 (준비 중)
        </button>
      </div>
    </div>
  );
}
