import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { tripService } from '@/shared/api/tripService';
import { DayChips } from '@/features/plan/DayChips';
import { ItineraryItemCard } from '@/features/plan/ItineraryItemCard';
import { FixedPointCard, FlightPointCard, LegBetween } from '@/features/plan/FixedPointCard';
import { useTripRoutes, type RouteWaypoint } from '@/features/plan/map/useTripRoutes';
import { getDayHotels } from '@/features/plan/map/hotels';
import { getDayCity } from '@/features/plan/dayCities';
import { getGuestName, saveGuestName } from './guestName';
import { GuestNameModal } from './GuestNameModal';
import { SuggestPlaceModal } from './SuggestPlaceModal';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { trackScreenView } from '@/shared/monitoring';
import type {
  DayCitiesData,
  FlightsData,
  HotelsData,
  PlannerData,
} from '@/features/plan/types';
import styles from './SharedTripScreen.module.css';

/** get_shared_trip() RPC(0013_fix_get_shared_trip_columns.sql)가 반환하는 형태 */
interface SharedTripPayload {
  tripId: string;
  projectName: string;
  city: string | null;
  cityLat: number | null;
  cityLng: number | null;
  startDate: string | null;
  endDate: string | null;
  currency: string;
  data: PlannerData;
  hotels: HotelsData;
  flights: FlightsData;
  dayCities: DayCitiesData;
  updatedAt: number;
}

/**
 * 공유 링크 뷰어 (index.html openSharedView/startSharedPolling 이식, 02-screens.md §3.2)
 * 로그인 없이 누구나 접근 가능한 읽기 전용 화면. 10초 주기로 폴링해 소유자가
 * 일정을 바꾸면 자동 반영한다(legacy startSharedPolling과 동일한 주기).
 * 동행자는 게스트 이름을 한 번 입력하면(localStorage) 장소를 건의할 수 있다.
 */
export function SharedTripScreen() {
  const { code } = useParams<{ code: string }>();
  const [currentDay, setCurrentDay] = useState(1);
  const [showSuggest, setShowSuggest] = useState(false);
  const [guestName, setGuestName] = useState(() => getGuestName());
  const [suggestSent, setSuggestSent] = useState(false);

  useEffect(() => {
    trackScreenView('shared_trip_view');
  }, []);

  const { data: payload, isLoading, isError } = useQuery({
    queryKey: ['shared-trip', code],
    queryFn: () => tripService.getSharedTripByCode(code!) as Promise<SharedTripPayload | null>,
    enabled: !!code,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="24px" width="60%" />
        <div style={{ height: 12 }} />
        <Skeleton height="88px" />
      </div>
    );
  }

  if (isError || !payload) {
    return <ErrorState summary="공유 링크가 만료되었거나 찾을 수 없어요." />;
  }

  const totalDays =
    payload.startDate && payload.endDate
      ? Math.round((parseISO(payload.endDate).getTime() - parseISO(payload.startDate).getTime()) / 86_400_000) + 1
      : 1;
  const hotelsData = payload.hotels ?? {};
  const flightsData = payload.flights ?? { outbound: null, return: null };
  const dayCitiesData = payload.dayCities ?? {};
  const plannerData = payload.data ?? {};
  const dayItems = plannerData[currentDay] ?? [];
  const { startHotel, endHotel } = getDayHotels(currentDay, totalDays, hotelsData);
  const currentCity = getDayCity(currentDay, dayCitiesData, {
    name: payload.city,
    lat: payload.cityLat,
    lng: payload.cityLng,
  });
  const isFirstDay = currentDay === 1;
  const isLastDay = currentDay === totalDays;
  const flightArrival =
    isFirstDay && flightsData.outbound?.arr.lat != null && flightsData.outbound.arr.lng != null
      ? flightsData.outbound
      : null;
  const flightDeparture =
    isLastDay && flightsData.return?.dep.lat != null && flightsData.return.dep.lng != null
      ? flightsData.return
      : null;

  async function handleSuggestSubmit(suggestion: Parameters<typeof tripService.addSuggestion>[1]) {
    if (!payload) return;
    await tripService.addSuggestion(payload.tripId, suggestion);
    setSuggestSent(true);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>✈️ {payload.projectName}</h1>
        <p className={styles.dates}>
          {payload.startDate} ~ {payload.endDate} ({totalDays}일간)
        </p>
      </header>

      <DayChips totalDays={totalDays} currentDay={currentDay} onChange={setCurrentDay} />

      <div className={styles.dayHeader}>
        <span>Day {currentDay}</span>
        <span className={styles.cityBadge}>📍 {currentCity.name ? currentCity.name.split(',')[0].trim() : '도시 미설정'}</span>
      </div>

      <SharedTimeline
        dayItems={dayItems}
        startHotel={startHotel}
        endHotel={endHotel}
        flightArrival={flightArrival}
        flightDeparture={flightDeparture}
      />

      <div className={styles.suggestButtonWrap}>
        <button type="button" className={styles.suggestButton} onClick={() => setShowSuggest(true)}>
          💡 장소 추가 건의하기
        </button>
        {suggestSent ? <p className={styles.suggestSent}>🎉 제안이 여행 작성자에게 전송되었어요!</p> : null}
      </div>

      {!guestName ? (
        <GuestNameModal
          projectName={payload.projectName}
          onConfirm={(name) => {
            if (name.trim()) saveGuestName(name);
            setGuestName(name.trim() || ' ');
          }}
        />
      ) : null}

      {showSuggest ? (
        <SuggestPlaceModal
          totalDays={totalDays}
          defaultDay={currentDay}
          onClose={() => setShowSuggest(false)}
          onSubmit={handleSuggestSubmit}
        />
      ) : null}
    </div>
  );
}

interface SharedTimelineProps {
  dayItems: PlannerData[number];
  startHotel: ReturnType<typeof getDayHotels>['startHotel'];
  endHotel: ReturnType<typeof getDayHotels>['endHotel'];
  flightArrival: SharedTripPayload['flights']['outbound'];
  flightDeparture: SharedTripPayload['flights']['return'];
}

/** 읽기 전용 타임라인 — TripDetailScreen의 TripTimeline과 동일한 시퀀스 순서를 따른다 */
function SharedTimeline({ dayItems, startHotel, endHotel, flightArrival, flightDeparture }: SharedTimelineProps) {
  const legs = useTripRoutes({
    map: null,
    dayItems,
    startHotel,
    endHotel,
    activeZoneIndex: 0,
    flightArrival:
      flightArrival && flightArrival.arr.lat != null && flightArrival.arr.lng != null
        ? { lat: flightArrival.arr.lat, lng: flightArrival.arr.lng }
        : null,
    flightDeparture:
      flightDeparture && flightDeparture.dep.lat != null && flightDeparture.dep.lng != null
        ? { lat: flightDeparture.dep.lat, lng: flightDeparture.dep.lng }
        : null,
  });

  const refs: RouteWaypoint['ref'][] = [];
  if (flightArrival) refs.push('flight-arrival');
  if (startHotel) refs.push('start-hotel');
  dayItems.forEach((_, i) => refs.push(i));
  if (endHotel) refs.push('end-hotel');
  if (flightDeparture) refs.push('flight-departure');

  function legAfter(ref: RouteWaypoint['ref']) {
    const idx = refs.indexOf(ref);
    if (idx === -1 || idx === refs.length - 1) return undefined;
    const nextRef = refs[idx + 1];
    return legs.find((l) => l.from.ref === ref && l.to.ref === nextRef);
  }

  const isEmpty = dayItems.length === 0 && !startHotel && !endHotel && !flightArrival && !flightDeparture;

  if (isEmpty) {
    return <EmptyState icon="📍" message="이 날에는 아직 일정이 없어요." />;
  }

  return (
    <div className={styles.timeline}>
      {flightArrival ? (
        <>
          <FlightPointCard flight={flightArrival} />
          <LegBetween leg={legAfter('flight-arrival')} />
        </>
      ) : null}

      {startHotel ? (
        <>
          <FixedPointCard icon="🏨" label="출발" name={startHotel.name} address={startHotel.address} />
          <LegBetween leg={legAfter('start-hotel')} />
        </>
      ) : null}

      {dayItems.map((item, index) => (
        <div key={item.key ?? `idx-${index}`}>
          <ItineraryItemCard index={index} item={item} />
          <LegBetween leg={legAfter(index)} />
        </div>
      ))}

      {endHotel ? <FixedPointCard icon="🏨" label="복귀" name={endHotel.name} address={endHotel.address} /> : null}
      {flightDeparture ? <FlightPointCard flight={flightDeparture} /> : null}
    </div>
  );
}
