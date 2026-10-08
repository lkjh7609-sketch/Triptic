import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CalendarCog, CalendarDays, ChevronRight, Eye, Pencil, Plus, Sparkles, Users } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { SAMPLE_TRIP_ID } from '@/features/plan/sampleTrip';
import { initialsOf } from '@/features/plan/hooks/useTripMembers';
import { relativeTime } from './relativeTime';
import { TripWeatherChip } from '@/features/weather/TripWeatherChip';
import { useUpcomingTrip, type UpcomingTripView } from './useUpcomingTrip';
import shared from './shared.module.css';
import styles from './MyTripsSection.module.css';

function dateParts(ymd: string, locale: string) {
  const d = new Date(`${ymd}T00:00:00`);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
  return { y: ymd.slice(0, 4), md: ymd.slice(5).replace('-', '.'), full: ymd.replaceAll('-', '.'), weekday };
}

function TripCard({ view, compact }: { view: UpcomingTripView; compact: boolean }) {
  const { t, i18n } = useTranslation('home');
  const { trip, daysUntil, nights, totalDays, completeness, members } = view;
  const start = dateParts(trip.start_date!, i18n.language);
  const end = dateParts(trip.end_date ?? trip.start_date!, i18n.language);
  const nightsDays = nights === 0 ? t('page.trips.dayTrip') : t('page.trips.nightsDays', { nights, days: totalDays });
  const dday = daysUntil > 0 ? `D-${daysUntil}` : daysUntil === 0 ? t('page.trips.dDay') : t('page.trips.ongoing');
  const others = Math.max(0, members.length - 1);
  const parts = [
    view.placeCount > 0 ? t('page.trips.places', { count: view.placeCount }) : null,
    view.hasHotel ? t('page.trips.hotelSet') : null,
    view.hasFlight ? t('page.trips.flightSet') : null,
  ].filter(Boolean);
  const summary = parts.length > 0 ? parts.join(' · ') : t('page.trips.nothingYet');

  return (
    <article className={`${shared.card} ${shared.cardHover} ${styles.card}`}>
      <div className={styles.cardBody}>
        <div className={styles.metaRow}>
          <div className={styles.metaLeft}>
            <span className={styles.ddayBadge}>{compact ? `${dday} ${t('page.trips.upcomingLabel')}` : dday}</span>
            <TripWeatherChip trip={trip} className={styles.metaText} />
            {compact ? null : (
              <span className={styles.metaText}>
                {`${start.full} - ${end.md} (${nightsDays})`}
              </span>
            )}
          </div>
          {compact ? (
            <span className={styles.metaText}>{nightsDays}</span>
          ) : others > 0 ? (
            <span className={styles.group}>
              <Users size={16} aria-hidden="true" /> {t('page.trips.withCompanions', { count: others })}
            </span>
          ) : null}
        </div>
        <h3 className={styles.cardTitle}>{trip.title}</h3>
        {compact ? (
          <p className={styles.cardDesc}>{`${start.full} (${start.weekday}) - ${end.md} (${end.weekday})`}</p>
        ) : (
          <p className={styles.cardDesc}>{summary}</p>
        )}
        <div className={styles.progress}>
          <div className={styles.progressHead}>
            <span className={styles.progressLabel}>{compact ? t('page.trips.progressShort') : t('page.trips.progress')}</span>
            <span className={styles.progressValue}>{compact ? `${completeness}%` : t('page.trips.progressDone', { pct: completeness })}</span>
          </div>
          <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completeness} aria-label={t('page.trips.progress')}>
            <div className={styles.fill} style={{ width: `${completeness}%` }} />
          </div>
        </div>
      </div>
      <div className={styles.cardFoot}>
        {compact ? (
          <span className={styles.footNote}>{summary}</span>
        ) : (
          <div className={styles.avatars} aria-hidden="true">
            {members.slice(0, 3).map((m) => (
              <span key={m.userId} className={styles.avatar}>
                {initialsOf(m.name)}
              </span>
            ))}
          </div>
        )}
        <Link to={`/plan/${trip.id}`} className={compact ? styles.editPill : `${shared.primaryBtn}`}>
          {compact ? null : <CalendarCog size={18} aria-hidden="true" />}
          <span>{compact ? t('page.trips.editShort') : t('page.trips.edit')}</span>
          {compact ? <Pencil size={14} aria-hidden="true" /> : null}
        </Link>
      </div>
    </article>
  );
}

function EmptyTripCard() {
  const { t } = useTranslation('home');
  return (
    <article className={`${shared.card} ${shared.emptyCard} ${styles.card}`}>
      <span className={shared.emptyIcon}>
        <CalendarDays size={24} aria-hidden="true" />
      </span>
      <h3 className={shared.emptyTitle}>{t('page.trips.emptyTitle')}</h3>
      <p className={shared.emptyDesc}>{t('page.trips.emptyDesc')}</p>
      <Link to="/plan" className={`${shared.primaryBtn} ${shared.emptyBtn}`}>
        <Plus size={18} aria-hidden="true" />
        <span>{t('page.trips.emptyCta')}</span>
      </Link>
    </article>
  );
}

/** 도쿄 샘플 — 앱 안의 임시 데이터라 로그인 없이 열어 볼 수 있고 저장은 되지 않는다(샘플 화면 열기만) */
function SampleCard({ compact }: { compact: boolean }) {
  const { t } = useTranslation('home');
  return (
    <article className={`${shared.card} ${shared.cardHover} ${styles.card} ${styles.sample}`}>
      <div className={styles.cardBody}>
        <div className={styles.metaRow}>
          <div className={styles.metaLeft}>
            <span className={styles.sampleBadge}>{compact ? t('page.trips.sampleTagMobile') : t('page.trips.sampleTag')}</span>
            {compact ? null : <span className={styles.metaText}>{t('page.trips.sampleRoute')}</span>}
          </div>
          {compact ? <span className={styles.metaText}>{t('page.trips.sampleRoute')}</span> : null}
        </div>
        <h3 className={styles.cardTitle}>{t('page.trips.sampleTitle')}</h3>
        <p className={styles.cardDesc}>{t('page.trips.sampleDesc')}</p>
        {compact ? null : (
          <div className={styles.note}>
            <Sparkles size={20} aria-hidden="true" className={styles.noteIcon} />
            <span>{t('page.trips.sampleNote')}</span>
          </div>
        )}
      </div>
      <div className={`${styles.cardFoot} ${styles.cardFootEnd}`}>
        <Link to={`/plan/${SAMPLE_TRIP_ID}`} className={compact ? styles.samplePill : styles.sampleBtn}>
          <Eye size={compact ? 14 : 18} aria-hidden="true" />
          <span>{t('page.trips.sampleView')}</span>
        </Link>
      </div>
    </article>
  );
}

/** "내 일정 & 추천 샘플" — 가장 가까운 내 여행 카드(없으면 빈 상태 카드) + 도쿄 샘플 카드 */
export function MyTripsSection({ desktop }: { desktop: boolean }) {
  const { t, i18n } = useTranslation('home');
  const { user } = useSession();
  const { view } = useUpcomingTrip(!!user);

  return (
    <section className={shared.section} aria-labelledby="home-trips-title">
      <div className={`${shared.head} ${styles.head}`}>
        <div className={styles.headTitle}>
          {desktop ? (
            <CalendarDays size={22} aria-hidden="true" className={styles.headIcon} />
          ) : (
            <span className={styles.pulse} aria-hidden="true" />
          )}
          <h2 id="home-trips-title" className={shared.title}>
            {t('page.trips.title')}
          </h2>
        </div>
        {desktop ? (
          view ? (
            <span className={styles.synced}>{t('page.trips.syncedAt', { time: relativeTime(view.trip.updated_at, i18n.language) })}</span>
          ) : null
        ) : (
          <Link to="/plan" className={shared.moreLink}>
            {t('page.all')}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className={styles.list}>
        {view ? <TripCard view={view} compact={!desktop} /> : <EmptyTripCard />}
        <SampleCard compact={!desktop} />
      </div>
    </section>
  );
}
