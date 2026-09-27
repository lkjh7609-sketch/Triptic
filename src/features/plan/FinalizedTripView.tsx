import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Hotel as HotelIcon } from 'lucide-react';
import { tripService, type TripRow } from '@/shared/api/tripService';
import { captureError } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { DayChips } from './DayChips';
import { ItineraryItemCard } from './ItineraryItemCard';
import { FixedPointCard, LegBetween } from './FixedPointCard';
import { useTripRoutes, type RouteWaypoint } from './map/useTripRoutes';
import { getDayHotels } from './map/hotels';
import { useReopenTrip } from './hooks/useTrips';
import type { PlaceItem } from './types';
import sharedStyles from '@/features/shared/SharedTripScreen.module.css';
import styles from './FinalizedTripView.module.css';

interface FinalizedTripViewProps {
  trip: TripRow;
}

/** 일정 완료(finalized_at 있음) 상태의 여행 — 편집 UI 대신 읽기 전용
 * 타임라인만 보여준다(TripDetailScreen의 거대한 편집기를 건드리지 않고
 * 이 단계에서 통째로 갈아끼운다). PostTripViewScreen과 같은 렌더링 조각을
 * 쓰지만 별도 RPC 없이 이미 로드된 trip.content를 그대로 쓴다(내 소유
 * 여행이라 useTrip이 이미 정규화 테이블을 재구성해 왔음). */
export function FinalizedTripView({ trip }: FinalizedTripViewProps) {
  const { t } = useTranslation(['plan', 'community']);
  const [currentDay, setCurrentDay] = useState(1);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const reopenMutation = useReopenTrip(trip.id);

  const project = tripService.toLocalProject(trip);
  const totalDays = Math.max(1, Number(project.totalDays ?? trip.total_days ?? 1) || 1);
  const dayItems: PlaceItem[] = (project.data as Record<number, PlaceItem[]> | undefined)?.[currentDay] ?? [];
  const hotelsByDay = (project.hotels as Record<number, { name: string; address?: string; lat: number; lng: number }> | undefined) ?? {};
  const { startHotel, endHotel } = getDayHotels(currentDay, totalDays, hotelsByDay);
  const dayCities = (project.dayCities as Record<number, { name: string }> | undefined) ?? {};
  const cityName = dayCities[currentDay]?.name ?? trip.city ?? undefined;

  async function handleReopen() {
    try {
      await reopenMutation.mutateAsync();
      showToast(t('quota.reopenSuccess'));
    } catch (err) {
      captureError(err, { context: 'reopenTrip' });
      showToast(err instanceof Error ? err.message : t('quota.reopenSuccess'));
    }
  }

  return (
    <div className={sharedStyles.screen}>
      <div className={styles.banner}>
        <span>{t('quota.finalizedBanner')}</span>
        <button type="button" className={styles.reopenBtn} disabled={reopenMutation.isPending} onClick={() => setConfirmReopen(true)}>
          {t('quota.reopenButton')}
        </button>
      </div>

      <header className={sharedStyles.header}>
        <h1 className={sharedStyles.title}>{trip.title}</h1>
        <p className={sharedStyles.dates}>
          {trip.start_date} ~ {trip.end_date}
        </p>
      </header>

      <DayChips totalDays={totalDays} currentDay={currentDay} onChange={setCurrentDay} />

      <div className={sharedStyles.dayHeader}>
        <span>{t('community:shared.dayLabel', { day: currentDay })}</span>
        <span className={sharedStyles.cityBadge}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} /></span>{' '}
          {cityName ? cityName.split(',')[0].trim() : t('community:shared.cityUnset')}
        </span>
      </div>

      <FinalizedTimeline dayItems={dayItems} startHotel={startHotel} endHotel={endHotel} />

      {confirmReopen ? (
        <ConfirmDialog
          title={t('quota.reopenButton')}
          message={t('quota.reopenConfirm')}
          cancelLabel={t('quota.reopenKeep')}
          confirmLabel={t('quota.reopenProceed')}
          onConfirm={handleReopen}
          onClose={() => setConfirmReopen(false)}
        />
      ) : null}
    </div>
  );
}

interface FinalizedTimelineProps {
  dayItems: PlaceItem[];
  startHotel: ReturnType<typeof getDayHotels>['startHotel'];
  endHotel: ReturnType<typeof getDayHotels>['endHotel'];
}

function FinalizedTimeline({ dayItems, startHotel, endHotel }: FinalizedTimelineProps) {
  const { t } = useTranslation('community');
  const legs = useTripRoutes({
    map: null,
    dayItems,
    startHotel,
    endHotel,
    activeZoneIndex: 0,
    flightArrival: null,
    flightDeparture: null,
  });

  const refs: RouteWaypoint['ref'][] = [];
  if (startHotel) refs.push('start-hotel');
  dayItems.forEach((_, i) => refs.push(i));
  if (endHotel) refs.push('end-hotel');

  function legAfter(ref: RouteWaypoint['ref']) {
    const idx = refs.indexOf(ref);
    if (idx === -1 || idx === refs.length - 1) return undefined;
    const nextRef = refs[idx + 1];
    return legs.find((l) => l.from.ref === ref && l.to.ref === nextRef);
  }

  const isEmpty = dayItems.length === 0 && !startHotel && !endHotel;

  if (isEmpty) {
    return <EmptyState icon={<MapPin size={48} />} message={t('shared.emptyDay')} />;
  }

  return (
    <div className={sharedStyles.timeline}>
      {startHotel ? (
        <>
          <FixedPointCard icon={<HotelIcon size={18} />} label={t('shared.departure')} name={startHotel.name} address={startHotel.address} />
          <LegBetween leg={legAfter('start-hotel')} />
        </>
      ) : null}

      {dayItems.map((item, index) => (
        <div key={item.key ?? `idx-${index}`}>
          <ItineraryItemCard index={index} item={item} />
          <LegBetween leg={legAfter(index)} />
        </div>
      ))}

      {endHotel ? (
        <FixedPointCard icon={<HotelIcon size={18} />} label={t('shared.return')} name={endHotel.name} address={endHotel.address} />
      ) : null}
    </div>
  );
}
