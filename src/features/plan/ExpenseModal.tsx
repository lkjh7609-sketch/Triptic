import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CURRENCIES,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  convertToBase,
  formatMoney,
  getCategoryTotalsSeries,
  getDayExpenseTotal,
  getDayTotalsSeries,
  getGrandExpenseTotal,
} from './expenses';
import { fetchDailyRate } from './fxRate';
import { ExpenseChart } from './ExpenseChart';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import type { ExpenseCategory, ExpenseItem, ExpensePaymentMethod, ExpensesData } from './types';
import styles from './ExpenseModal.module.css';
import modalStyles from './AddPlaceModal.module.css';

interface ExpenseModalProps {
  currentDay: number;
  totalDays: number;
  currency: string;
  expensesData: ExpensesData;
  onClose: () => void;
  onSave: (dayExpenses: ExpenseItem[]) => Promise<void>;
}

const CATEGORY_ICON: Record<ExpenseCategory, string> = {
  food: '🍽',
  transport: '🚌',
  lodging: '🏨',
  shopping: '🛍',
  activity: '🎢',
  other: '📦',
};

/**
 * 이 날의 경비 (index.html renderExpenseSection/addExpense/deleteExpense 이식 +
 * 02-screens.md §3.7 확장). 목록 자체는 이 시트를 여는 즉시 저장한다(add/delete
 * 각각 즉시 반영) — legacy와 동일하게 "저장" 버튼 없이 바로 서버에 쓴다.
 *
 * 여행 기본 통화와 다른 통화로 입력하면 fxRate.ts로 그날 환율을 조회해
 * fxRateToBase에 스냅샷으로 저장한다. 조회에 실패해도 저장 자체는 막지 않고
 * (네트워크 문제로 입력을 통째로 막는 게 더 나쁘다고 판단) 합계에서만 제외한다.
 */
export function ExpenseModal({ currentDay, totalDays, currency, expensesData, onClose, onSave }: ExpenseModalProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [itemCurrency, setItemCurrency] = useState(currency);
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod | ''>('');
  const [saving, setSaving] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);
  const [fxWarning, setFxWarning] = useState<string | null>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);

  const list = expensesData[currentDay] ?? [];
  const dayTotal = getDayExpenseTotal(list, currency);
  const grandTotal = getGrandExpenseTotal(expensesData, currency);
  const currSymbol = (CURRENCIES[itemCurrency] ?? CURRENCIES.KRW).symbol;

  function unconvertedNote(count: number): string {
    return count > 0 ? ` ${t('expense.unconvertedCount', { count })}` : '';
  }

  async function handleAdd() {
    const amountNum = Number(amount);
    if (!desc.trim() || !amountNum) return;
    setSaving(true);
    setFxWarning(null);
    try {
      let fxRateToBase: number | null = null;
      if (itemCurrency !== currency) {
        setFetchingRate(true);
        fxRateToBase = await fetchDailyRate(itemCurrency, currency);
        setFetchingRate(false);
        if (fxRateToBase == null) {
          setFxWarning(t('expense.fxWarning'));
        }
      }
      const newItem: ExpenseItem = {
        desc: desc.trim(),
        amount: amountNum,
        currency: itemCurrency,
        category,
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(itemCurrency !== currency ? { fxRateToBase } : {}),
      };
      await onSave([...list, newItem]);
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
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('expense.title')}
      >
        <h2 className={modalStyles.title}>💰 {t('expense.title')}</h2>

        <div className={styles.addRow}>
          <input
            className={styles.descInput}
            placeholder={t('expense.descPlaceholder')}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div className={styles.detailsRow}>
          <input
            className={styles.amountInput}
            type="number"
            placeholder={t('expense.amountPlaceholder', { symbol: currSymbol })}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className={styles.smallSelect}
            value={itemCurrency}
            onChange={(e) => setItemCurrency(e.target.value)}
            aria-label={t('expense.currencyAria')}
          >
            {Object.keys(CURRENCIES).map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <select
            className={styles.smallSelect}
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            aria-label={t('expense.categoryAria')}
          >
            {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {t(`expense.category.${cat}`)}
              </option>
            ))}
          </select>
          <select
            className={styles.smallSelect}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod | '')}
            aria-label={t('expense.paymentAria')}
          >
            <option value="">{t('expense.paymentPlaceholder')}</option>
            {(Object.keys(PAYMENT_METHOD_LABELS) as ExpensePaymentMethod[]).map((pm) => (
              <option key={pm} value={pm}>
                {t(`expense.payment.${pm}`)}
              </option>
            ))}
          </select>
          <button type="button" className={styles.addBtn} disabled={saving} onClick={handleAdd}>
            {fetchingRate ? t('expense.fetchingRate') : t('action.add', { ns: 'common' })}
          </button>
        </div>
        {fxWarning ? <p className={styles.warning}>{fxWarning}</p> : null}

        <div className={styles.list}>
          {list.length === 0 ? (
            <p className={styles.empty}>{t('expense.empty')}</p>
          ) : (
            list.map((e, i) => {
              const itemCur = e.currency ?? currency;
              const converted = convertToBase(e, currency);
              return (
                <div key={i} className={styles.listItem}>
                  <span className={styles.itemIcon}>{CATEGORY_ICON[e.category ?? 'other']}</span>
                  <span className={styles.itemDesc}>
                    {e.desc}
                    {e.paymentMethod ? (
                      <span className={styles.itemMeta}> · {t(`expense.payment.${e.paymentMethod}`)}</span>
                    ) : null}
                  </span>
                  <span className={styles.itemAmount}>
                    {formatMoney(e.amount, itemCur, i18n.language)}
                    {itemCur !== currency ? (
                      <span className={styles.itemConverted}>
                        {converted != null
                          ? ` ≈ ${formatMoney(converted, currency, i18n.language)}`
                          : ` (${t('expense.unconverted')})`}
                      </span>
                    ) : null}
                  </span>
                  <button type="button" className={styles.deleteBtn} disabled={saving} onClick={() => handleDelete(i)}>
                    {t('action.delete', { ns: 'common' })}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.totalRow}>
          <span>{t('expense.dayTotal')}</span>
          <span>
            {formatMoney(dayTotal.total, currency, i18n.language)}
            {unconvertedNote(dayTotal.unconverted)}
          </span>
        </div>
        <div className={styles.grandTotalRow}>
          <span>{t('expense.grandTotal')}</span>
          <span>
            {formatMoney(grandTotal.total, currency, i18n.language)}
            {unconvertedNote(grandTotal.unconverted)}
          </span>
        </div>

        <ExpenseChart
          title={t('expense.chartByDay')}
          data={getDayTotalsSeries(expensesData, totalDays, currency, (day) => t('day.header', { index: day }))}
          currency={currency}
        />
        <ExpenseChart
          title={t('expense.chartByCategory')}
          data={getCategoryTotalsSeries(expensesData, currency, (cat) => t(`expense.category.${cat}`))}
          currency={currency}
        />

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primary} onClick={onClose}>
            {t('action.close', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  );
}
