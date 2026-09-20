import { useState } from 'react';
import { CURRENCIES, formatMoney, getDayExpenseTotal, getGrandExpenseTotal } from './expenses';
import type { ExpenseItem, ExpensesData } from './types';
import styles from './ExpenseModal.module.css';
import modalStyles from './AddPlaceModal.module.css';

interface ExpenseModalProps {
  currentDay: number;
  currency: string;
  expensesData: ExpensesData;
  onClose: () => void;
  onSave: (dayExpenses: ExpenseItem[]) => Promise<void>;
}

/**
 * 이 날의 경비 (index.html renderExpenseSection/addExpense/deleteExpense 이식)
 * 목록 자체는 이 시트를 여는 즉시 저장한다(add/delete 각각 즉시 반영) — legacy와
 * 동일하게 "저장" 버튼 없이 바로 서버에 쓴다.
 */
export function ExpenseModal({ currentDay, currency, expensesData, onClose, onSave }: ExpenseModalProps) {
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const list = expensesData[currentDay] ?? [];
  const dayTotal = getDayExpenseTotal(list);
  const grandTotal = getGrandExpenseTotal(expensesData);
  const currSymbol = (CURRENCIES[currency] ?? CURRENCIES.KRW).symbol;

  async function handleAdd() {
    const amountNum = Number(amount);
    if (!desc.trim() || !amountNum) return;
    setSaving(true);
    try {
      await onSave([...list, { desc: desc.trim(), amount: amountNum }]);
      setDesc('');
      setAmount('');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(index: number) {
    setSaving(true);
    try {
      await onSave(list.filter((_, i) => i !== index));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.sheet} onClick={(e) => e.stopPropagation()}>
        <h2 className={modalStyles.title}>💰 이 날의 경비</h2>

        <div className={styles.addRow}>
          <input
            className={styles.descInput}
            placeholder="사용처 (예: 점심 식사)"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <input
            className={styles.amountInput}
            type="number"
            placeholder={`금액 (${currSymbol})`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button type="button" className={styles.addBtn} disabled={saving} onClick={handleAdd}>
            추가
          </button>
        </div>

        <div className={styles.list}>
          {list.length === 0 ? (
            <p className={styles.empty}>아직 등록된 경비가 없습니다.</p>
          ) : (
            list.map((e, i) => (
              <div key={i} className={styles.listItem}>
                <span className={styles.itemDesc}>{e.desc}</span>
                <span className={styles.itemAmount}>{formatMoney(e.amount, currency)}</span>
                <button type="button" className={styles.deleteBtn} disabled={saving} onClick={() => handleDelete(i)}>
                  삭제
                </button>
              </div>
            ))
          )}
        </div>

        <div className={styles.totalRow}>
          <span>이 날 합계</span>
          <span>{formatMoney(dayTotal, currency)}</span>
        </div>
        <div className={styles.grandTotalRow}>
          <span>전체 여행 합계</span>
          <span>{formatMoney(grandTotal, currency)}</span>
        </div>

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primary} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
