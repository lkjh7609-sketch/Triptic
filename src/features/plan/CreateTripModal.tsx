import { useMemo, useState } from 'react';
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
}

/**
 * 여행 생성 (02-screens.md §3.1 "+" 버튼, index.html handleNewProjectClick/
 * submitCreateProject 이식). 최소 필드만 — 상세 편집은 여행 상세 화면에서.
 * 도시는 legacy와 동일하게 Places Autocomplete((cities))로 **반드시 선택**해야
 * 한다(자유 텍스트 금지) — cityLat/cityLng가 있어야 날씨·지도 경로가 동작한다.
 */
export function CreateTripModal({ onClose }: CreateTripModalProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const navigate = useNavigate();
  const createTrip = useCreateTrip();
  const [city, setCity] = useState<SelectedPlace | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const { inputRef: cityInputRef } = usePlaceAutocomplete((place) => {
    setCity(place);
    setCityError(null);
  }, { types: ['(cities)'] });
  const trapRef = useFocusTrap<HTMLFormElement>(onClose);
  const schema = useMemo(() => buildCreateTripSchema(t), [t, i18n.language]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(schema),
    defaultValues: { currency: 'KRW' },
  });

  async function onSubmit(values: CreateTripValues) {
    if (!city) {
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
          city: city.address || city.name,
          cityLat: city.lat,
          cityLng: city.lng,
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
        onSubmit={handleSubmit(onSubmit)}
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
            defaultValue=""
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

        <div className={styles.row}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="trip-start">
              {t('createTrip.startLabel')}
            </label>
            <input id="trip-start" type="date" className={styles.input} {...register('startDate')} />
            {errors.startDate ? (
              <span className={styles.error}>{errors.startDate.message}</span>
            ) : null}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="trip-end">
              {t('createTrip.endLabel')}
            </label>
            <input id="trip-end" type="date" className={styles.input} {...register('endDate')} />
            {errors.endDate ? <span className={styles.error}>{errors.endDate.message}</span> : null}
          </div>
        </div>

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
