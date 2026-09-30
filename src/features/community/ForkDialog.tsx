import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, addDays } from 'date-fns';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import { forkDates } from '@/features/plan/forkDates';
import styles from './ForkDialog.module.css';

interface ForkDialogProps {
  /** 원본 출발일·일 수 — 일 수는 그대로 두고 고른 날부터 이어 붙인다 */
  originalStart: string;
  totalDays: number;
  onConfirm: (startDate: string) => void;
  onClose: () => void;
}

/**
 * 커뮤니티 일정 복사 — 새 여행의 출발일을 고르는 확인 창.
 * 바깥(어두운 배경)을 눌러도 닫히지 않는다 — 취소 버튼과 Esc로만 닫는다(팝업 원칙).
 */
export function ForkDialog({ originalStart, totalDays, onConfirm, onClose }: ForkDialogProps) {
  const { t } = useTranslation('community');
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  // 원본 출발일이 아직 안 지났으면 그대로, 지났으면 내일부터
  const [start, setStart] = useState(originalStart >= tomorrow ? originalStart : tomorrow);
  const { endDate } = forkDates(originalStart, totalDays, start || originalStart);

  return (
    <div className={modalStyles.overlay}>
      <div ref={focusTrapRef} className={modalStyles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('postTrip.forkDialogTitle')}>
        <h2 className={modalStyles.title}>{t('postTrip.forkDialogTitle')}</h2>
        <p className={styles.message}>{t('postTrip.forkConfirm')}</p>
        <label className={styles.field}>
          <span className={styles.label}>{t('postTrip.forkStartLabel')}</span>
          <input type="date" className={styles.input} value={start} min={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setStart(e.target.value)} />
        </label>
        <p className={styles.range}>{start ? t('postTrip.forkRange', { start, end: endDate, days: totalDays }) : ''}</p>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('postTrip.forkKeep')}
          </button>
          <button
            type="button"
            className={modalStyles.primary}
            disabled={!start}
            onClick={() => {
              onClose();
              onConfirm(start);
            }}
          >
            {t('postTrip.forkProceed')}
          </button>
        </div>
      </div>
    </div>
  );
}
