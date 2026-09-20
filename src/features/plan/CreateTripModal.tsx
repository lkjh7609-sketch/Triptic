import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import { useCreateTrip } from './hooks/useTrips';
import { captureError } from '@/shared/monitoring';
import styles from './CreateTripModal.module.css';

const CreateTripSchema = z
  .object({
    title: z.string().min(1, '여행 이름을 입력해 주세요').max(100),
    city: z.string().max(100).optional(),
    startDate: z.string().min(1, '시작일을 선택해 주세요'),
    endDate: z.string().min(1, '종료일을 선택해 주세요'),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: '종료일은 시작일 이후여야 해요',
    path: ['endDate'],
  });

type CreateTripValues = z.infer<typeof CreateTripSchema>;

interface CreateTripModalProps {
  onClose: () => void;
}

/** 여행 생성 (02-screens.md §3.1 "+" 버튼). 최소 필드만 — 상세 편집은 여행 상세 화면에서 */
export function CreateTripModal({ onClose }: CreateTripModalProps) {
  const navigate = useNavigate();
  const createTrip = useCreateTrip();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateTripValues>({
    resolver: zodResolver(CreateTripSchema),
  });

  async function onSubmit(values: CreateTripValues) {
    try {
      const totalDays =
        Math.round(
          (new Date(values.endDate).getTime() - new Date(values.startDate).getTime()) /
            86_400_000,
        ) + 1;
      const row = await createTrip.mutateAsync({
        name: values.title,
        project: {
          city: values.city || null,
          startDate: values.startDate,
          endDate: values.endDate,
          totalDays,
          currency: 'KRW',
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
            도시 (선택)
          </label>
          <input id="trip-city" className={styles.input} placeholder="Tokyo" {...register('city')} />
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
