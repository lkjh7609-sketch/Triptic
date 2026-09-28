import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { MapPin, Hotel as HotelIcon } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { DayChips } from '@/features/plan/DayChips';
import { ItineraryItemCard } from '@/features/plan/ItineraryItemCard';
import { FixedPointCard, LegBetween } from '@/features/plan/FixedPointCard';
import { useTripRoutes } from '@/features/plan/map/useTripRoutes';
import type { RouteWaypoint } from '@/features/plan/map/useTripRoutes';
import { getDayHotels, type Hotel } from '@/features/plan/map/hotels';
import type { PlaceCategory } from '@/features/plan/placeCategory';
import type { PlaceItem } from '@/features/plan/types';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { usePostTrip, useForkPostTrip } from './hooks/usePosts';
import type { ItineraryItemRow } from '@/features/plan/itineraryTransform';
import postDetailStyles from './PostDetailScreen.module.css';
import sharedStyles from '@/features/shared/SharedTripScreen.module.css';
import styles from './PostTripViewScreen.module.css';
import { cityDisplayName } from '@/features/plan/cityName';

function toPlaceItem(row: ItineraryItemRow): PlaceItem {
  return {
    name: row.title,
    address: row.address ?? undefined,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    placeId: row.google_place_id ?? undefined,
    time: row.start_local ? row.start_local.split('T')[1] : undefined,
    memo: row.memo ?? undefined,
    category: (row.category as PlaceCategory) ?? undefined,
    key: `${row.day_id}-${row.position}`,
  };
}

/**
 * 커뮤니티 글에 첨부된 일정 읽기 전용 뷰(0036) — SharedTripScreen(공유 링크)과
 * 같은 타임라인 렌더링을 쓰지만, 게스트 이름/장소 제안/폴링은 없다(이건 이미
 * 공개된 글에 달린 정적 스냅샷이지 실시간 협업 대상이 아니다). 대신 "복제"
 * 버튼으로 내 계정에 편집 가능한 사본을 만들 수 있다.
 */
export function PostTripViewScreen() {
  const { t } = useTranslation('community');
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const [currentDay, setCurrentDay] = useState(1);
  const [confirmFork, setConfirmFork] = useState(false);
  const [forkedTripId, setForkedTripId] = useState<string | null>(null);
  const forkMutation = useForkPostTrip();

  const { data: payload, isLoading, isError } = usePostTrip(postId);

  useEffect(() => {
    trackScreenView('community_post_trip_view');
  }, []);

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
    return <ErrorState summary={t('postTrip.loadError')} />;
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

  const dayItems: PlaceItem[] = dayRow
    ? payload.items
        .filter((it) => it.day_id === dayRow.id && it.type !== 'lodging')
        .sort((a, b) => a.position - b.position)
        .map(toPlaceItem)
    : [];

  async function handleFork() {
    if (!postId) return;
    try {
      const row = await forkMutation.mutateAsync({ postId, title: `${payload!.trip.title}${t('postTrip.forkTitleSuffix')}` });
      setForkedTripId(row.id);
    } catch (err) {
      captureError(err, { context: 'forkPostTrip' });
    }
  }

  return (
    <div className={sharedStyles.screen}>
      <button type="button" className={postDetailStyles.backBtn} onClick={() => navigate(-1)}>
        ← {t('action.back', { ns: 'common' })}
      </button>

      <header className={sharedStyles.header}>
        <h1 className={sharedStyles.title}>{payload.trip.title}</h1>
        <p className={sharedStyles.dates}>
          {payload.trip.start_date} ~ {payload.trip.end_date} ({t('shared.daysCount', { count: totalDays })})
        </p>
      </header>

      <DayChips totalDays={totalDays} currentDay={currentDay} onChange={setCurrentDay} />

      <div className={sharedStyles.dayHeader}>
        <span>{t('shared.dayLabel', { day: currentDay })}</span>
        <span className={sharedStyles.cityBadge}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MapPin size={16} /></span>{' '}
          {dayRow?.city_name ? cityDisplayName(dayRow.city_name) : t('shared.cityUnset')}
        </span>
      </div>

      <PostTripTimeline dayItems={dayItems} startHotel={startHotel} endHotel={endHotel} />

      {user ? (
        <div className={styles.forkButtonWrap}>
          {forkedTripId ? (
            <p className={styles.forkedNotice}>{t('postTrip.forkSuccess')}</p>
          ) : (
            <button type="button" className={styles.forkButton} disabled={forkMutation.isPending} onClick={() => setConfirmFork(true)}>
              {t('postTrip.forkButton')}
            </button>
          )}
        </div>
      ) : null}

      {confirmFork ? (
        <ConfirmDialog
          title={t('postTrip.forkButton')}
          message={t('postTrip.forkConfirm')}
          cancelLabel={t('postTrip.forkKeep')}
          confirmLabel={t('postTrip.forkProceed')}
          onConfirm={handleFork}
          onClose={() => setConfirmFork(false)}
        />
      ) : null}
    </div>
  );
}

interface PostTripTimelineProps {
  dayItems: PlaceItem[];
  startHotel: ReturnType<typeof getDayHotels>['startHotel'];
  endHotel: ReturnType<typeof getDayHotels>['endHotel'];
}

/** SharedTripScreen의 SharedTimeline과 동일한 순서/레이아웃(TripDetailScreen의
 * TripTimeline과 같은 시퀀스) — 항공편 고정 카드는 정규화 테이블에 도착공항
 * 좌표가 없어 재현하지 않고 일반 항목으로 흘려보낸다(SharedTripScreen과 동일한
 * 기존 한계). */
function PostTripTimeline({ dayItems, startHotel, endHotel }: PostTripTimelineProps) {
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
