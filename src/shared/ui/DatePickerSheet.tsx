import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import { CalendarRangePicker } from './CalendarRangePicker';
import styles from './DatePickerSheet.module.css';

interface DatePickerSheetProps {
  title: string;
  /** YYYY-MM-DD, 없으면 '' */
  value: string;
  /** 달력에 은은하게 표시해 둘 기간(예: 이 여행의 시작~종료일) */
  markStart?: string | null;
  markEnd?: string | null;
  onPick: (ymd: string) => void;
  onClose: () => void;
}

function parseYmd(ymd: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function toYmd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 하루를 고르는 달력 시트 — 모바일은 아래에서 올라오고 PC는 가운데 창(AddPlaceModal 스타일). 날짜를 누르면 바로 고르고 닫힌다. 닫기 버튼·Esc로도 닫힌다 */
export function DatePickerSheet({
  title,
  value,
  markStart,
  markEnd,
  onPick,
  onClose,
}: DatePickerSheetProps) {
  const { t } = useTranslation('common');
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const selected = useMemo(() => parseYmd(value), [value]);
  const start = useMemo(() => parseYmd(markStart), [markStart]);
  const end = useMemo(() => parseYmd(markEnd), [markEnd]);

  return createPortal(
    <div className={`${modalStyles.overlay} ${styles.overlay}`}>
      <div
        ref={trapRef}
        className={`${modalStyles.sheet} ${styles.sheet}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.head}>
          <h2 className={`${modalStyles.title} ${styles.title}`}>{title}</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('action.close')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <CalendarRangePicker
          mode="single"
          allowPast
          startDate={selected}
          endDate={null}
          markStart={start}
          markEnd={end}
          onChange={(day) => {
            if (!day) return;
            onPick(toYmd(day));
            onClose();
          }}
        />
        {start && end ? <p className={styles.legend}>{t('datePicker.tripRange')}</p> : null}
      </div>
    </div>,
    document.body,
  );
}
