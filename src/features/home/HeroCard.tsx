import { Link } from 'react-router';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Plane } from 'lucide-react';
import type { TripRow } from '@/shared/api/tripService';
import { tripService } from '@/shared/api/tripService';
import { getDDay } from '@/features/plan/tripStatus';
import { useWeather } from '@/features/weather/useWeather';
import { mapConditionCode, weatherIcon } from '@/features/weather/conditionMap';
import { formatTemp } from '@/features/weather/weatherRules';
import { useTempUnit } from '@/shared/hooks/useTempUnit';
import type { FlightsData, PlannerData } from '@/features/plan/types';
import { useCityImage } from '@/shared/hooks/useCityImage';
import styles from './HeroCard.module.css';

const todayISO = () => format(new Date(), 'yyyy-MM-dd');

interface HeroCardProps {
  /** 가장 가까운 예정 여행 (D-day 오름차순 1건) */
  upcoming?: TripRow;
  /** 오늘이 기간 내인 여행 */
  ongoing?: TripRow;
}

/**
 * 홈 히어로 카드 (02-screens.md §2.1, §2.3)
 * 우선순위: 여행 중 > 예정 여행 > (둘 다 없으면) "다음 여행을 계획해 보세요".
 * 여행 중일 때 "현재 위치 기준 이동 안내"는 위치 권한·실시간 좌표가 더 필요해
 * 이번 라운드는 빼고 오늘 일정 목록까지만 보여준다.
 */
export function HeroCard({ upcoming, ongoing }: HeroCardProps) {
  const { t } = useTranslation('home');
  if (ongoing) return <OngoingHero trip={ongoing} />;
  if (upcoming) return <UpcomingHero trip={upcoming} />;
  return (
    <div className={`${styles.card} ${styles.emptyCard}`}>
      <p className={styles.emptyMessage}>{t('hero.planNext')}</p>
      <Link to="/plan" className={styles.cta}>
        {t('hero.createTrip')}
      </Link>
    </div>
  );
}

function UpcomingHero({ trip }: { trip: TripRow }) {
  const { t } = useTranslation('home');
  const dday = getDDay(trip.start_date);
  const project = tripService.toLocalProject(trip);
  const firstItem = ((project.data as PlannerData | undefined)?.[1] ?? [])[0];
  const outbound = (project.flights as FlightsData | undefined)?.outbound;
  const weather = useWeather(trip.city_lat, trip.city_lng, todayISO(), todayISO());
  const current = weather.data?.current;
  const tempUnit = useTempUnit();
  const bgImage = useCityImage(trip.city);

  return (
    <Link to={`/plan/${trip.id}`} className={styles.card} style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%), url('${bgImage}')` }}>
      <div className={styles.header}>
        {dday != null ? <span className={styles.ddayBadge}>{dday === 0 ? 'D-DAY' : `D-${dday}`}</span> : null}
        <h2 className={styles.title}>{trip.title}</h2>
      </div>
      <p className={styles.dates}>
        {trip.start_date && trip.end_date
          ? `${format(new Date(trip.start_date), 'yyyy.MM.dd')} – ${format(new Date(trip.end_date), 'MM.dd')}`
          : ''}
      </p>
      <div className={styles.infoRow}>
        {current ? (
          <span>
            {weatherIcon(mapConditionCode(current.conditionCode), current.isDaylight)}{' '}
            {trip.city ? trip.city.split(',')[0].trim() : ''} {formatTemp(current.tempC, tempUnit)}
          </span>
        ) : null}
        {firstItem?.time ? <span>{t('hero.firstItem', { time: firstItem.time })}</span> : null}
      </div>
      {outbound ? (
        <p className={styles.flightRow}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Plane size={18} />
          </span>{' '}
          {outbound.flightNo} {outbound.dep.iata || outbound.dep.name} → {outbound.arr.iata || outbound.arr.name}
        </p>
      ) : null}
    </Link>
  );
}

function OngoingHero({ trip }: { trip: TripRow }) {
  const { t } = useTranslation('home');
  const project = tripService.toLocalProject(trip);
  const totalDays = project.totalDays || 1;
  const dayIndex = trip.start_date
    ? Math.min(
        totalDays,
        Math.max(
          1,
          Math.round((new Date(todayISO()).getTime() - new Date(trip.start_date).getTime()) / 86_400_000) + 1,
        ),
      )
    : 1;
  const todayItems = ((project.data as PlannerData | undefined)?.[dayIndex] ?? []).slice(0, 3);
  const bgImage = useCityImage(trip.city);

  return (
    <Link to={`/plan/${trip.id}`} className={`${styles.card} ${styles.ongoingCard}`} style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%), url('${bgImage}')` }}>
      <div className={styles.header}>
        <span className={styles.ongoingBadge}>{t('hero.todayBadge')}</span>
        <h2 className={styles.title}>{trip.title}</h2>
      </div>
      <p className={styles.dates}>
        {t('hero.dayIndex', { day: dayIndex, date: format(new Date(), 'M/d (E)', { locale: ko }) })}
      </p>
      {todayItems.length > 0 ? (
        <ul className={styles.itemList}>
          {todayItems.map((item, i) => (
            <li key={i}>
              {item.time ? <span className={styles.itemTime}>{item.time}</span> : null} {item.name}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyMessage}>{t('hero.noItemsToday')}</p>
      )}
    </Link>
  );
}
