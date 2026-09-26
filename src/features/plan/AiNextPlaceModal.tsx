import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, MapPin, Wallet, Info, Check, X, ArrowLeft, RotateCcw } from 'lucide-react';
import { TimeWheelPicker } from '@/shared/ui/TimeWheelPicker';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { apiUrl } from '@/shared/api/apiUrl';
import { tripService, type TripRow } from '@/shared/api/tripService';
import { useProfile } from '@/shared/hooks/useProfile';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { captureError } from '@/shared/monitoring';
import { haversineKm, formatDistance } from './map/geo';
import { resolvePlace } from './resolvePlace';
import { inferPlaceCategory, type PlaceCategory } from './placeCategory';
import type { DayCitiesData, PlaceItem } from './types';
import modalStyles from './AddPlaceModal.module.css';
import styles from './AiNextPlaceModal.module.css';

interface AiNextPlaceModalProps {
  trip: TripRow;
  currentDay: number;
  /** 이 장소 "다음"에 갈 곳을 추천한다. 그날 일정이 비어 있으면 undefined(도시 기준 추천) */
  baseItem: PlaceItem | undefined;
  onClose: () => void;
  onAddPlace: (place: PlaceItem) => void;
}

/** /api/recommend 응답의 추천 1건 */
interface ApiRecommendation {
  name: string;
  category?: string;
  categoryLabel?: string;
  signatureMenu?: string;
  priceRange?: string;
  reason?: string;
  tip?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
  address?: string;
}

type Located =
  | { status: 'pending' }
  | { status: 'found'; lat: number; lng: number; address: string; placeId: string | null; types: string[] }
  | { status: 'notFound' };

interface Recommendation {
  id: string;
  rec: ApiRecommendation;
  located: Located;
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready' };

const REC_CATEGORY_TO_PLACE: Record<string, PlaceCategory> = {
  restaurant: 'restaurant',
  cafe: 'cafe',
  culture: 'sight',
  spot: 'sight',
};

export function AiNextPlaceModal({ trip, currentDay, baseItem, onClose, onAddPlace }: AiNextPlaceModalProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const { data: profile } = useProfile();
  const distanceUnit = profile?.distance_unit === 'mi' ? 'mi' : 'km';
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const dayCities = (tripService.toLocalProject(trip).dayCities ?? {}) as DayCitiesData;
  const dayCityName = dayCities[currentDay]?.name;
  const city = (dayCityName ?? trip.city ?? '').split(',')[0].trim();
  const placeName = baseItem?.name ?? city;
  const baseLat = baseItem?.lat;
  const baseLng = baseItem?.lng;
  const locale = i18n.language;

  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState<Recommendation | null>(null);
  const [time, setTime] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const bias = baseLat != null && baseLng != null ? { lat: baseLat, lng: baseLng } : null;

    async function load() {
      setLoadState({ status: 'loading' });
      setRecs([]);
      try {
        const res = await fetch(apiUrl('/api/recommend'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placeName, city, category: 'all', locale, lat: baseLat, lng: baseLng }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`recommend HTTP ${res.status}`);
        const data = (await res.json()) as { recommendations?: ApiRecommendation[] };
        const list: Recommendation[] = (data.recommendations ?? []).map((rec, i) => ({
          id: `${i}-${rec.name}`,
          rec,
          located:
            rec.lat != null && rec.lng != null
              ? { status: 'found', lat: rec.lat, lng: rec.lng, address: rec.address ?? '', placeId: rec.placeId ?? null, types: [] }
              : { status: 'pending' },
        }));
        if (controller.signal.aborted) return;
        setRecs(list);
        setLoadState({ status: 'ready' });

        // 서버가 좌표를 못 붙인 항목은 브라우저에서 Google 좌표를 찾는다(병렬)
        await Promise.all(
          list
            .filter((r) => r.located.status === 'pending')
            .map(async (r) => {
              let located: Located = { status: 'notFound' };
              try {
                const found = await resolvePlace(city ? `${r.rec.name} ${city}` : r.rec.name, bias);
                if (found) located = { status: 'found', ...found };
              } catch (err) {
                captureError(err, { context: 'aiNextPlace.resolvePlace' });
              }
              if (controller.signal.aborted) return;
              setRecs((prev) => prev.map((p) => (p.id === r.id ? { ...p, located } : p)));
            }),
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        captureError(err, { context: 'aiNextPlace.fetch' });
        setLoadState({ status: 'error' });
      }
    }

    void load();
    return () => controller.abort();
  }, [placeName, city, locale, baseLat, baseLng, attempt]);

  function distanceLabel(located: Located): string | null {
    if (located.status !== 'found' || baseLat == null || baseLng == null) return null;
    const km = haversineKm(baseLat, baseLng, located.lat, located.lng);
    return t('aiNext.distanceFrom', { place: placeName, distance: formatDistance(km, distanceUnit, locale) });
  }

  function handleFinalAdd() {
    if (!confirming || confirming.located.status !== 'found') return;
    const { rec, located } = confirming;
    const typesCategory = inferPlaceCategory(located.types);
    onAddPlace({
      key: crypto.randomUUID(),
      name: rec.name,
      address: located.address,
      lat: located.lat,
      lng: located.lng,
      placeId: located.placeId,
      ...(time ? { time } : {}),
      memo: rec.tip ?? '',
      category: typesCategory !== 'other' ? typesCategory : (REC_CATEGORY_TO_PLACE[rec.category ?? ''] ?? 'other'),
    });
    onClose();
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-next-title"
        className={`${modalStyles.sheet} ${styles.aiSheet}`}
        onClick={(e) => e.stopPropagation()}
      >
        {confirming ? (
          <>
            <div className={styles.header}>
              <button type="button" className={styles.backBtn} onClick={() => setConfirming(null)} aria-label={t('common:action.back')}>
                <ArrowLeft size={20} />
              </button>
              <h2 id="ai-next-title">{t('aiNext.timeTitle')}</h2>
              <p>{t('aiNext.timeSubtitle', { name: confirming.rec.name })}</p>
            </div>
            <div className={styles.timeConfirmView}>
              <div className={modalStyles.field} style={{ marginBottom: 'var(--space-4)' }}>
                <span className={modalStyles.label}>{t('aiNext.timeLabel')}</span>
                <TimeWheelPicker value={time} onChange={setTime} />
              </div>
              <div className={modalStyles.actions}>
                <button type="button" className={modalStyles.secondary} onClick={() => setConfirming(null)}>
                  {t('common:action.back')}
                </button>
                <button type="button" className={modalStyles.primary} onClick={handleFinalAdd}>
                  {t('aiNext.confirmAdd')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.header}>
              <h2 id="ai-next-title">
                <Sparkles size={18} color="var(--brand)" /> {t('aiNext.title')}
              </h2>
              <p>{baseItem ? t('aiNext.subtitle', { place: placeName }) : t('aiNext.subtitleCity', { city })}</p>
            </div>

            {loadState.status === 'loading' ? (
              <div className={styles.list} aria-busy="true" aria-label={t('aiNext.loading')}>
                <p className={styles.loadingText}>{t('aiNext.loading')}</p>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} height="120px" />
                ))}
              </div>
            ) : loadState.status === 'error' ? (
              <div className={styles.errorState} role="alert">
                <p>{t('aiNext.error')}</p>
                <button type="button" className={modalStyles.secondary} onClick={() => setAttempt((n) => n + 1)}>
                  <RotateCcw size={14} /> {t('common:action.retry')}
                </button>
              </div>
            ) : recs.length === 0 ? (
              <p className={styles.emptyText}>{t('aiNext.empty')}</p>
            ) : (
              <div className={styles.list}>
                {recs.map((r) => {
                  const distance = distanceLabel(r.located);
                  return (
                    <div key={r.id} className={styles.card}>
                      <div className={styles.cardHeader}>
                        <h3>{r.rec.name}</h3>
                        {r.rec.categoryLabel ? <span className={styles.categoryTag}>{r.rec.categoryLabel}</span> : null}
                      </div>
                      <div className={styles.metaInfo}>
                        <span>
                          <MapPin size={14} />{' '}
                          {r.located.status === 'pending'
                            ? t('aiNext.locating')
                            : r.located.status === 'notFound'
                              ? t('aiNext.locationNotFound')
                              : (distance ?? r.located.address)}
                        </span>
                        {r.rec.priceRange ? (
                          <span>
                            <Wallet size={14} /> {r.rec.priceRange}
                          </span>
                        ) : null}
                      </div>

                      {r.rec.reason ? (
                        <div className={styles.reasonBox}>
                          <div className={styles.reasonTitle}>
                            <Info size={14} /> {t('aiNext.whyTitle')}
                          </div>
                          <p>{r.rec.reason}</p>
                          {r.rec.tip ? <p className={styles.tip}>{t('aiNext.tip', { tip: r.rec.tip })}</p> : null}
                        </div>
                      ) : null}

                      <div className={styles.actionButtons}>
                        <button
                          type="button"
                          className={styles.rejectBtn}
                          onClick={() => setRecs((prev) => prev.filter((p) => p.id !== r.id))}
                        >
                          <X size={16} /> {t('aiNext.notInterested')}
                        </button>
                        <button
                          type="button"
                          className={styles.acceptBtn}
                          disabled={r.located.status !== 'found'}
                          onClick={() => setConfirming(r)}
                        >
                          <Check size={16} /> {t('aiNext.addToPlan')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className={styles.aiNotice}>{t('aiNext.aiNotice')}</p>
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} onClick={onClose}>
                {t('common:action.close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
