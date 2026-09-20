import { useState } from 'react';
import type { PlaceItem } from './types';
import styles from './ItemDetailSheet.module.css';

interface ItemDetailSheetProps {
  item: PlaceItem;
  onClose: () => void;
  onSave: (patch: Partial<PlaceItem>) => Promise<void>;
  onDelete: () => Promise<void>;
}

/**
 * 일정 항목 상세 시트 (02-screens.md §3.2 "항목 탭 → 상세 시트")
 * 이번 라운드는 시간·메모 편집 + 삭제까지만 다룬다. 전화·영업시간·사진은
 * Places Details 추가 호출이 필요해 범위가 커서 후속 작업으로 미룬다.
 */
export function ItemDetailSheet({ item, onClose, onSave, onDelete }: ItemDetailSheetProps) {
  const [time, setTime] = useState(item.time ?? '');
  const [memo, setMemo] = useState(item.memo ?? '');
  const [busy, setBusy] = useState(false);

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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{item.name}</h2>
        {item.address ? <p className={styles.address}>{item.address}</p> : null}

        <a
          className={styles.directionsLink}
          href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
          target="_blank"
          rel="noopener"
        >
          Google Maps에서 보기 ↗
        </a>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="item-time">
            시간
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
            메모
          </label>
          <input
            id="item-memo"
            className={styles.input}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.deleteButton} disabled={busy} onClick={handleDelete}>
            삭제
          </button>
          <button type="button" className={styles.primary} disabled={busy} onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
