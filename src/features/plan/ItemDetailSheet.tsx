import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import type { PlaceItem } from './types';
import styles from './ItemDetailSheet.module.css';

interface ItemDetailSheetProps {
  item: PlaceItem;
  currentDay: number;
  totalDays: number;
  onClose: () => void;
  onSave: (patch: Partial<PlaceItem>) => Promise<void>;
  onDelete: () => Promise<void>;
  onMoveToDay: (targetDay: number) => Promise<void>;
}

/**
 * 일정 항목 상세 시트 (02-screens.md §3.2 "항목 탭 → 상세 시트")
 * 시간·메모 편집 + 삭제 + 다른 날로 이동(§10.3 패리티 항목)까지 다룬다.
 * 전화·영업시간·사진은 Places Details 추가 호출이 필요해 후속 작업으로 미룬다.
 */
export function ItemDetailSheet({
  item,
  currentDay,
  totalDays,
  onClose,
  onSave,
  onDelete,
  onMoveToDay,
}: ItemDetailSheetProps) {
  const { t } = useTranslation(['plan', 'common']);
  const [time, setTime] = useState(item.time ?? '');
  const [memo, setMemo] = useState(item.memo ?? '');
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  async function handleSave() {
    setBusy(true);
    try {
      await onSave({ time: time || undefined, memo: memo || undefined });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(e: React.ChangeEvent<HTMLSelectElement>) {
    const targetDay = Number(e.target.value);
    if (!targetDay || targetDay === currentDay) return;
    setBusy(true);
    try {
      await onMoveToDay(targetDay);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={trapRef}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
      >
        <h2 className={styles.title}>{item.name}</h2>
        {item.address ? <p className={styles.address}>{item.address}</p> : null}

        <a
          className={styles.directionsLink}
          href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
          target="_blank"
          rel="noopener"
        >
          {t('itemDetail.mapLink')} ↗
        </a>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-time">
            {t('itemDetail.timeLabel')}
          </label>
          <input
            id="item-time"
            type="time"
            className={styles.input}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-memo">
            {t('itemDetail.memoLabel')}
          </label>
          <input
            id="item-memo"
            className={styles.input}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {totalDays > 1 ? (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="item-move-day">
              {t('itemDetail.moveToDay')}
            </label>
            <select id="item-move-day" className={styles.input} value={currentDay} disabled={busy} onChange={handleMove}>
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => (
                <option key={day} value={day}>
                  {t('day.header', { index: day })}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={styles.actions}>
          <button type="button" className={styles.deleteButton} disabled={busy} onClick={handleDelete}>
            {t('action.delete', { ns: 'common' })}
          </button>
          <button type="button" className={styles.primary} disabled={busy} onClick={handleSave}>
            {t('action.save', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}
