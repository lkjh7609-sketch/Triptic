import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Hotel, MapPin, Plane, Utensils, X } from 'lucide-react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { adminGetTrip, type AdminTripView } from './adminService';
import styles from './AdminTripViewer.module.css';

function timeOf(local: string | null): string {
  if (!local) return '';
  const t = local.includes('T') ? local.split('T')[1] : local;
  return t.slice(0, 5);
}

/**
 * 운영자용 여행 보기(읽기 전용) — 회원이 일정을 어떻게 만들었는지 일차별로 본다: 장소·시간·메모·식사, 숙소, 항공편.
 * 예약 서류·경비는 열지 않는다(필요한 만큼만). 고칠 수 없다.
 */
export function AdminTripViewer({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const { t } = useTranslation('community');
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const view = useQuery<AdminTripView>({ queryKey: ['admin', 'trip-view', tripId], queryFn: () => adminGetTrip(tripId), staleTime: 60_000 });
  const data = view.data;

  return (
    <div className={styles.overlay}>
      <div ref={trapRef} className={styles.sheet} role="dialog" aria-modal="true" aria-label={t('admin.members.tripView.title')} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <div>
            <p className={styles.badge}>{t('admin.members.tripView.readonly')}</p>
            <h2 className={styles.title}>{data?.trip?.title ?? t('admin.members.tripView.title')}</h2>
            {data?.trip ? (
              <p className={styles.sub}>
                {[
                  data.trip.city,
                  data.trip.start_date && data.trip.end_date ? `${data.trip.start_date} ~ ${data.trip.end_date}` : null,
                  data.trip.total_days ? t('admin.members.days', { count: data.trip.total_days }) : null,
                  data.trip.owner_name ? t('admin.members.tripView.owner', { name: data.trip.owner_name, handle: data.trip.owner_handle ?? '' }) : null,
                  data.trip.member_count > 1 ? t('admin.members.tripView.members', { count: data.trip.member_count }) : null,
                  data.trip.deleted_at ? t('admin.members.tripDeleted') : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('admin.members.tripView.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {view.isLoading ? (
          <Skeleton height="120px" />
        ) : view.isError || !data?.trip ? (
          <ErrorState summary={t('admin.members.tripView.loadError')} onRetry={() => view.refetch()} />
        ) : (
          <div className={styles.body}>
            {data.flights.length > 0 ? (
              <section className={styles.block}>
                <h3 className={styles.blockTitle}>
                  <Plane size={16} aria-hidden="true" /> {t('admin.members.tripView.flights')}
                </h3>
                {data.flights.map((f) => (
                  <p key={f.id} className={styles.line}>
                    <strong>{f.type === 'return' ? t('admin.members.tripView.return') : t('admin.members.tripView.outbound')}</strong>{' '}
                    {[f.airline, f.flight_no].filter(Boolean).join(' ')} · {f.dep_iata ?? f.dep_name ?? '?'} {f.dep_time ?? ''} → {f.arr_iata ?? f.arr_name ?? '?'} {f.arr_time ?? ''}
                  </p>
                ))}
              </section>
            ) : null}

            {data.days.length === 0 ? <p className={styles.muted}>{t('admin.members.tripView.empty')}</p> : null}
            {data.days.map((day) => {
              const items = data.items.filter((i) => i.day_id === day.id).sort((a, b) => a.position - b.position);
              const hotel = data.hotels.find((h) => h.day === day.day_index);
              return (
                <section key={day.id} className={styles.block}>
                  <h3 className={styles.blockTitle}>
                    {t('admin.members.tripView.day', { n: day.day_index })}
                    <span className={styles.dayMeta}>{[day.date, day.city_name].filter(Boolean).join(' · ')}</span>
                  </h3>
                  {day.note ? <p className={styles.note}>{day.note}</p> : null}
                  {items.length === 0 ? <p className={styles.muted}>{t('admin.members.tripView.noItems')}</p> : null}
                  <ol className={styles.items}>
                    {items.map((item) => (
                      <li key={item.id} className={styles.item}>
                        <span className={styles.time}>{timeOf(item.start_local)}</span>
                        <span className={styles.itemMain}>
                          <span className={styles.itemTitle}>
                            {item.type === 'meal' ? <Utensils size={14} aria-hidden="true" /> : <MapPin size={14} aria-hidden="true" />}
                            {item.title}
                            {item.type === 'meal' && item.subtitle ? <span className={styles.chip}>{item.subtitle}</span> : null}
                          </span>
                          {item.address ? <span className={styles.itemSub}>{item.address}</span> : null}
                          {item.memo ? <span className={styles.itemMemo}>{item.memo}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                  {hotel ? (
                    <p className={styles.hotel}>
                      <Hotel size={14} aria-hidden="true" /> {hotel.name}
                      {hotel.address ? <span className={styles.itemSub}> · {hotel.address}</span> : null}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
