import { useMemo, useState, useEffect, useRef } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useCreateTrip } from './hooks/useTrips';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { CURRENCIES } from './expenses';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import styles from './CreateTripModal.module.css';
import { CalendarRangePicker } from '@/shared/ui/CalendarRangePicker';
import { format } from 'date-fns';
import { loadGoogleMapsPlaces } from '@/shared/api/googleMapsLoader';

/**
 * <input type="date">는 정상적인 사용자 입력에서는 항상 YYYY-MM-DD(4자리 연도)를
 * 내놓지만, 값이 비정상 경로(자동화, 수동 조작 등)로 세팅되면 "110120-02-06"처럼
 * 파싱은 되지만 의미 없는 문자열이 들어올 수 있다 — 이 경우 TripDetailScreen의
 * 날짜 계산이 RangeError로 크래시했다. 형식과 연도 범위를 함께 검증한다.
 *
 * 검증 메시지는 t()가 필요해 스키마를 모듈 스코프 상수 대신 컴포넌트 안에서
 * 현재 언어로 빌드한다(buildCreateTripSchema) — 언어가 바뀌면 스키마도 다시 빌드된다.
 */
const dateField = (t: TFunction, message: string) =>
  z
    .string()
    .min(1, message)
    .regex(/^\d{4}-\d{2}-\d{2}$/, t('createTrip.errors.dateFormat'))
    .refine((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100;
    }, t('createTrip.errors.dateInvalid'));

function buildCreateTripSchema(t: TFunction) {
  return z
    .object({
      title: z.string().min(1, t('createTrip.errors.titleRequired')).max(100),
      startDate: dateField(t, t('createTrip.errors.startRequired')),
      endDate: dateField(t, t('createTrip.errors.endRequired')),
      currency: z.string(),
    })
    .refine((v) => v.endDate >= v.startDate, {
      message: t('createTrip.errors.endAfterStart'),
      path: ['endDate'],
    });
}

type CreateTripValues = z.infer<ReturnType<typeof buildCreateTripSchema>>;

interface CreateTripModalProps {
  onClose: () => void;
  autoCreateCity?: string | null;
}

/**
 * 여행 생성 (02-screens.md §3.1 "+" 버튼, index.html handleNewProjectClick/
 * submitCreateProject 이식). 최소 필드만 — 상세 편집은 여행 상세 화면에서.
 * 도시는 legacy와 동일하게 Places Autocomplete((cities))로 **반드시 선택**해야
 * 한다(자유 텍스트 금지) — cityLat/cityLng가 있어야 날씨·지도 경로가 동작한다.
 */
export function CreateTripModal({ onClose, autoCreateCity }: CreateTripModalProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const navigate = useNavigate();
  const createTrip = useCreateTrip();
  const [city, setCity] = useState<SelectedPlace | null>(null);
  const resolvedCityRef = useRef<SelectedPlace | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');
  const [showCalendar, setShowCalendar] = useState(false);
  const { inputRef: cityInputRef } = usePlaceAutocomplete((place) => {
    setCity(place);
    setCityError(null);
  }, { types: ['(cities)'] });
  const trapRef = useFocusTrap<HTMLFormElement>(onClose);
  const schema = useMemo(() => buildCreateTripSchema(t), [t, i18n.language]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }, setValue,
  } = useForm<CreateTripValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'KRW' },
  });


  useEffect(() => {
    if (autoCreateCity) {
      // 도시만 자동입력해주고 나머지는 수동 기입하도록 변경 (자동 생성 방지)
      if (cityInputRef.current) cityInputRef.current.value = autoCreateCity;
      const resolveCity = async () => {
        try {
          await loadGoogleMapsPlaces();
          const service = new google.maps.places.PlacesService(document.createElement('div'));
          service.textSearch({ query: autoCreateCity } as any, (results, status) => {
             if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
               const place = results[0];
               const resolved = {
                 name: place.name || autoCreateCity,
                 address: place.formatted_address || autoCreateCity,
                 lat: place.geometry?.location?.lat() || 0,
                 lng: place.geometry?.location?.lng() || 0,
                 placeId: place.place_id || null,
                 types: place.types || []
               };
               setCity(resolved);
               resolvedCityRef.current = resolved;
             }
          });
        } catch (e) {
          console.error('Failed to resolve city:', e);
        }
      };
      resolveCity();
    }
  }, [autoCreateCity]);

  async function onSubmit(values: CreateTripValues) {
    const targetCity = city || resolvedCityRef.current;
    if (!targetCity) {
      setCityError(t('createTrip.cityRequired'));
      return;
    }
    try {
      const totalDays =
        Math.round(
          (new Date(values.endDate).getTime() - new Date(values.startDate).getTime()) /
            86_400_000,
        ) + 1;
      const row = await createTrip.mutateAsync({
        name: values.title,
        project: {
          city: targetCity.address || targetCity.name,
          cityLat: targetCity.lat,
          cityLng: targetCity.lng,
          startDate: values.startDate,
          endDate: values.endDate,
          totalDays,
          currency: values.currency,
          data: {},
          hotels: {},
          meals: {},
          expenses: {},
          flights: { outbound: null, return: null },
          dayCities: {},
        },
      });
      onClose();
      navigate(`/plan/${row.id}`);
    } catch (err) {
      captureError(err, { context: 'createTrip' });
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <form
        ref={trapRef}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        onSubmit={e => { e.preventDefault(); handleSubmit(onSubmit)(); }}
        role="dialog"
        aria-modal="true"
        aria-label={t('createTrip.title')}
      >
        <h2 className={styles.title}>{t('createTrip.title')}</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="trip-title">
            {t('createTrip.nameLabel')}
          </label>
          <input
            id="trip-title"
            className={styles.input}
            placeholder={t('createTrip.namePlaceholder')}
            {...register('title')}
          />
          {errors.title ? <span className={styles.error}>{errors.title.message}</span> : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="trip-city">
            {t('createTrip.cityLabel')}
          </label>
          <input
            id="trip-city"
            ref={cityInputRef}
            className={styles.input}
            placeholder={t('createTrip.cityPlaceholderExample')}
            defaultValue={autoCreateCity || ''}
          />
          {cityError ? <span className={styles.error}>{cityError}</span> : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="trip-currency">
            {t('createTrip.currencyLabel')}
          </label>
          <select id="trip-currency" className={styles.input} {...register('currency')}>
            {Object.entries(CURRENCIES).map(([code, meta]) => (
              <option key={code} value={code}>
                {code} ({meta.symbol})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>{t('createTrip.startLabel')} - {t('createTrip.endLabel')}</label>
          <div 
            className={styles.input}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onClick={() => setShowCalendar(true)}
          >
             {startDateStr && endDateStr ? `${startDateStr} ~ ${endDateStr}` : '날짜를 선택해주세요'}
          </div>
          <input type="hidden" {...register('startDate')} value={startDateStr} />
          <input type="hidden" {...register('endDate')} value={endDateStr} />
          {(errors.startDate || errors.endDate) ? (
            <span className={styles.error}>{errors.startDate?.message || errors.endDate?.message}</span>
          ) : null}
        </div>

        {showCalendar && (
           <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowCalendar(false)}>
             <div style={{ background: 'var(--surface-card, #ffffff)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
               <CalendarRangePicker 
                 startDate={startDateStr ? new Date(startDateStr) : null}
                 endDate={endDateStr ? new Date(endDateStr) : null}
                 onChange={(start, end) => {
                   const s = start ? format(start, 'yyyy-MM-dd') : '';
                   const e = end ? format(end, 'yyyy-MM-dd') : '';
                   setStartDateStr(s); setValue('startDate', s, { shouldValidate: true });
                   setEndDateStr(e); setValue('endDate', e, { shouldValidate: true });
                   // If both selected, close automatically after a short delay
                   if (start && end) setTimeout(() => setShowCalendar(false), 300);
                 }}
               />
               <div style={{ marginTop: 'var(--space-4)', textAlign: 'right' }}>
                 <button type="button" onClick={() => setShowCalendar(false)} style={{ padding: '8px 16px', background: 'var(--brand)', color: 'white', border: 'none', borderRadius: '8px' }}>확인</button>
               </div>
             </div>
           </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('action.cancel', { ns: 'common' })}
          </button>
          <button type="submit" className={styles.primary} disabled={isSubmitting}>
            {isSubmitting ? t('createTrip.creating') : t('createTrip.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
