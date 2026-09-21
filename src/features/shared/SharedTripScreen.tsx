import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { tripService } from '@/shared/api/tripService';
import { DayChips } from '@/features/plan/DayChips';
import { ItineraryItemCard } from '@/features/plan/ItineraryItemCard';
import { FixedPointCard, LegBetween } from '@/features/plan/FixedPointCard';
import { useTripRoutes, type RouteWaypoint } from '@/features/plan/map/useTripRoutes';
import { getDayHotels, type Hotel } from '@/features/plan/map/hotels';
import { getGuestName, saveGuestName } from './guestName';
import { GuestNameModal } from './GuestNameModal';
import { SuggestPlaceModal } from './SuggestPlaceModal';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { trackScreenView } from '@/shared/monitoring';
import type { PlaceCategory } from '@/features/plan/placeCategory';
import type { PlaceItem } from '@/features/plan/types';
import styles from './SharedTripScreen.module.css';

/** get_shared_trip() RPC(0008_shared_trip_cutover.sql, 정규화 테이블 기반)가 반환하는 형태 */
interface SharedDayRow {
  id: string;
  day_index: number;
  date: string;
  city_name: string | null;
  city_lat: number | null;
  city_lng: number | null;
  timezone: string | null;
}
interface SharedItemRow {
  id: string;
  day_id: string;
  position: number;
  type: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  start_local: string | null;
  memo: string | null;
}
interface SharedTripPayload {
  trip: { id: string; title: string; start_date: string; end_date: string; base_currency: string };
  days: SharedDayRow[];
  items: SharedItemRow[];
  legs: unknown[];
}

/** items(정규화 행) → 화면이 이미 알고 있는 PlaceItem 형태로 되돌린다.
 * ⚠️ 항공편(type='flight')은 이 정규화 행에 출발공항 좌표만 남아있어(도착공항
 * 좌표는 이 테이블 스키마에 없음) FlightPointCard의 dep/arr 두 지점 렌더링을
 * 재현할 수 없다 — 일반 항목처럼 dayItems 흐름에 그대로 흘려보낸다(간단하지만
 * 정확한 절충, Plan 탭 자체 화면은 snapshot을 그대로 쓰므로 영향 없음). */
function toPlaceItem(row: SharedItemRow): PlaceItem {
  return {
    name: row.title,
    address: row.address ?? undefined,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    placeId: row.google_place_id,
    time: row.start_local ? row.start_local.split('T')[1] : undefined,
    memo: row.memo ?? undefined,
    category: (row.category as PlaceCategory) ?? undefined,
    key: row.id,
  };
}

/**
 * 공유 링크 뷰어 (index.html openSharedView/startSharedPolling 이식, 02-screens.md §3.2)
 * 로그인 없이 누구나 접근 가능한 읽기 전용 화면. 10초 주기로 폴링해 소유자가
 * 일정을 바꾸면 자동 반영한다(legacy startSharedPolling과 동일한 주기).
 * 동행자는 게스트 이름을 한 번 입력하면(localStorage) 장소를 건의할 수 있다.
 */
export function SharedTripScreen() {
  const { t } = useTranslation('community');
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
    return <ErrorState summary={t('shared.loadError')} />;
  }

  const days = payload.days ?? [];
  const totalDays = days.length || 1;
  const dayRow = days.find((d) => d.day_index === currentDay) ?? null;

  const hotelsByDay: Record<number, Hotel | undefined> = {};
  for (const d of days) {
    const hotelItem = payload.items.find((it) => it.day_id === d.id && it.type === 'lodging');
    if (hotelItem && hotelItem.lat != null && hotelItem.lng != null) {
      hotelsByDay[d.day_index] = { name: hotelItem.title, address: hotelItem.address ?? undefined, lat: hotelItem.lat, lng: hotelItem.lng };
    }
  }
  const { startHotel, endHotel } = getDayHotels(currentDay, totalDays, hotelsByDay);

  // 항공편(type='flight')도 도착공항 좌표가 없어 일반 항목으로 함께 흐른다(위 toPlaceItem 주석 참고)
  const dayItems: PlaceItem[] = dayRow
    ? payload.items
        .filter((it) => it.day_id === dayRow.id && it.type !== 'lodging')
        .sort((a, b) => a.position - b.position)
        .map(toPlaceItem)
    : [];

  async function handleSuggestSubmit(suggestion: Parameters<typeof tripService.addSuggestion>[1]) {
    if (!payload) return;
    await tripService.addSuggestion(payload.trip.id, suggestion);
    setSuggestSent(true);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>✈️ {payload.trip.title}</h1>
        <p className={styles.dates}>
          {payload.trip.start_date} ~ {payload.trip.end_date} ({t('shared.daysCount', { count: totalDays })})
        </p>
      </header>

      <DayChips totalDays={totalDays} currentDay={currentDay} onChange={setCurrentDay} />

      <div className={styles.dayHeader}>
        <span>{t('shared.dayLabel', { day: currentDay })}</span>
        <span className={styles.cityBadge}>
          📍 {dayRow?.city_name ? dayRow.city_name.split(',')[0].trim() : t('shared.cityUnset')}
        </span>
      </div>

      <SharedTimeline dayItems={dayItems} startHotel={startHotel} endHotel={endHotel} />

      <div className={styles.suggestButtonWrap}>
        <button type="button" className={styles.suggestButton} onClick={() => setShowSuggest(true)}>
          {t('suggest.title')}
        </button>
        {suggestSent ? <p className={styles.suggestSent}>{t('shared.suggestSent')}</p> : null}
      </div>

      {!guestName ? (
        <GuestNameModal
          projectName={payload.trip.title}
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
  dayItems: PlaceItem[];
  startHotel: ReturnType<typeof getDayHotels>['startHotel'];
  endHotel: ReturnType<typeof getDayHotels>['endHotel'];
}

/** 읽기 전용 타임라인 — TripDetailScreen의 TripTimeline과 동일한 시퀀스 순서를 따른다.
 * 항공편 고정 카드(FlightPointCard)는 정규화 테이블에 도착공항 좌표가 없어(위
 * toPlaceItem 주석 참고) 재현하지 않는다 — dayItems 흐름에 일반 항목으로 포함된다. */
function SharedTimeline({ dayItems, startHotel, endHotel }: SharedTimelineProps) {
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
    return <EmptyState icon="📍" message={t('shared.emptyDay')} />;
  }

  return (
    <div className={styles.timeline}>
      {startHotel ? (
        <>
          <FixedPointCard icon="🏨" label={t('shared.departure')} name={startHotel.name} address={startHotel.address} />
          <LegBetween leg={legAfter('start-hotel')} />
        </>
      ) : null}

      {dayItems.map((item, index) => (
        <div key={item.key ?? `idx-${index}`}>
          <ItineraryItemCard index={index} item={item} />
          <LegBetween leg={legAfter(index)} />
        </div>
      ))}

      {endHotel ? <FixedPointCard icon="🏨" label={t('shared.return')} name={endHotel.name} address={endHotel.address} /> : null}
    </div>
  );
}
