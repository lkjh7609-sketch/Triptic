import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useCreateTrip } from './hooks/useTrips';
import { usePlaceAutocomplete, type SelectedPlace } from './map/usePlaceAutocomplete';
import { CURRENCIES } from './expenses';
import { captureError } from '@/shared/monitoring';
import styles from './CreateTripModal.module.css';

/**
 * <input type="date">는 정상적인 사용자 입력에서는 항상 YYYY-MM-DD(4자리 연도)를
 * 내놓지만, 값이 비정상 경로(자동화, 수동 조작 등)로 세팅되면 "110120-02-06"처럼
 * 파싱은 되지만 의미 없는 문자열이 들어올 수 있다 — 이 경우 TripDetailScreen의
 * 날짜 계산이 RangeError로 크래시했다. 형식과 연도 범위를 함께 검증한다.
 */
const dateField = (message: string) =>
  z
    .string()
    .min(1, message)
    .regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않아요')
    .refine((v) => {
      const d = new Date(v);
      return !Number.isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100;
    }, '유효한 날짜를 선택해 주세요');

const CreateTripSchema = z
  .object({
    title: z.string().min(1, '여행 이름을 입력해 주세요').max(100),
    startDate: dateField('시작일을 선택해 주세요'),
    endDate: dateField('종료일을 선택해 주세요'),
    currency: z.string(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: '종료일은 시작일 이후여야 해요',
    path: ['endDate'],
  });

type CreateTripValues = z.infer<typeof CreateTripSchema>;

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
  const navigate = useNavigate();
  const createTrip = useCreateTrip();
  const [city, setCity] = useState<SelectedPlace | null>(null);
  const [cityError, setCityError] = useState<string | null>(null);
  const { inputRef: cityInputRef } = usePlaceAutocomplete((place) => {
    setCity(place);
    setCityError(null);
  }, { types: ['(cities)'] });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(CreateTripSchema),
    defaultValues: { currency: 'KRW' },
  });

  async function onSubmit(values: CreateTripValues) {
    if (!city) {
      setCityError('목적지 도시를 검색해서 선택해 주세요.');
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
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit(onSubmit)}
      >
        <h2 className={styles.title}>새 여행</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="trip-title">
            여행 이름
          </label>
          <input
            id="trip-title"
            className={styles.input}
            placeholder="도쿄 여행"
            {...register('title')}
          />
          {errors.title ? <span className={styles.error}>{errors.title.message}</span> : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="trip-city">
            목적지 도시 (검색 후 선택)
          </label>
          <input
            id="trip-city"
            ref={cityInputRef}
            className={styles.input}
            placeholder="예: Kyoto, Japan"
            defaultValue=""
          />
          {cityError ? <span className={styles.error}>{cityError}</span> : null}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="trip-currency">
            통화 설정
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
              시작일
            </label>
            <input id="trip-start" type="date" className={styles.input} {...register('startDate')} />
            {errors.startDate ? (
              <span className={styles.error}>{errors.startDate.message}</span>
            ) : null}
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="trip-end">
              종료일
            </label>
            <input id="trip-end" type="date" className={styles.input} {...register('endDate')} />
            {errors.endDate ? <span className={styles.error}>{errors.endDate.message}</span> : null}
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            취소
          </button>
          <button type="submit" className={styles.primary} disabled={isSubmitting}>
            {isSubmitting ? '만드는 중…' : '만들기'}
          </button>
        </div>
      </form>
    </div>
  );
}
