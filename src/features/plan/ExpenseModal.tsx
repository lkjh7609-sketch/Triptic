import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,

  convertToBase,
  formatMoney,
  formatRate,
  getCategoryTotalsSeries,
  getDayExpenseTotal,
  getDayTotalsSeries,
  getGrandExpenseTotal,
} from './expenses';
import { getRate } from './fxRates';
import { useFxRates } from './useFxRates';
import { ExpenseChart } from './ExpenseChart';
import { DoughnutChart } from './DoughnutChart';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import type { ExpenseCategory, ExpenseItem, ExpensePaymentMethod, ExpensesData } from './types';
import styles from './ExpenseModal.module.css';
import modalStyles from './AddPlaceModal.module.css';
import { Utensils, Bus, Hotel, ShoppingBag, FerrisWheel, Package, Coins } from 'lucide-react';

interface ExpenseModalProps {
  currentDay: number;
  totalDays: number;
  currency: string;
  expensesData: ExpensesData;
  onClose: () => void;
  onSave: (dayExpenses: ExpenseItem[]) => Promise<void>;
}

const CATEGORY_ICON: Record<ExpenseCategory, React.ReactNode> = {
  food: <Utensils size={18} />,
  transport: <Bus size={18} />,
  lodging: <Hotel size={18} />,
  shopping: <ShoppingBag size={18} />,
  activity: <FerrisWheel size={18} />,
  other: <Package size={18} />,
};

/**
 * 이 날의 경비 (index.html renderExpenseSection/addExpense/deleteExpense 이식 +
 * 02-screens.md §3.7 확장). 목록 자체는 이 시트를 여는 즉시 저장한다(add/delete
 * 각각 즉시 반영) — legacy와 동일하게 "저장" 버튼 없이 바로 서버에 쓴다.
 *
 * 여행 기본 통화와 다른 통화로 입력하면 1시간마다 갱신되는 환율(fxRates.ts)로
 * 환산 비율을 fxRateToBase에 스냅샷으로 저장한다. 환율이 없으면(첫 실행 전·오프라인
 * 첫 사용 등) 저장 자체는 막지 않고(입력을 통째로 막는 게 더 나쁘다고 판단) 합계에서만
 * 제외한다.
 */
export function ExpenseModal({ currentDay, totalDays, currency, expensesData, onClose, onSave }: ExpenseModalProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [itemCurrency, setItemCurrency] = useState(currency);
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [paymentMethod, _setPaymentMethod] = useState<ExpensePaymentMethod | ''>('');
  const [saving, setSaving] = useState(false);
  const [fxWarning, setFxWarning] = useState<string | null>(null);
  const fxRates = useFxRates();
  const previewRate = itemCurrency !== currency ? getRate(fxRates.data, itemCurrency, currency) : null;
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
        fxRateToBase = getRate(fxRates.data, itemCurrency, currency);
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
        <h2 className={modalStyles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Coins size={18} /> {t('expense.title')}</span></h2>

        <div className={styles.addRow}>
          <input
            className={styles.descInput}
            placeholder={t('expense.descPlaceholder')}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </div>
        <div className={styles.inputSection}>
          <div className={styles.categoryRow} role="radiogroup" aria-label={t('expense.categoryAria')}>
            {EXPENSE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="radio"
                aria-checked={category === cat}
                className={category === cat ? styles.categoryBtnActive : styles.categoryBtn}
                onClick={() => setCategory(cat)}
                title={t(`expense.category.${cat}`)}
              >
                {CATEGORY_ICON[cat]}
              </button>
            ))}
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
            <button type="button" className={styles.addBtn} disabled={saving} onClick={handleAdd}>
              {t('action.add', { ns: 'common' })}
            </button>
          </div>
        </div>
        {previewRate != null ? (
          <p className={styles.rateHint}>
            {t('expense.rateHint', {
              from: formatMoney(1, itemCurrency, i18n.language),
              to: formatRate(previewRate, currency, i18n.language),
              time: fxRates.data?.newestAt
                ? new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' }).format(new Date(fxRates.data.newestAt))
                : '',
            })}
          </p>
        ) : null}
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
        <DoughnutChart
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
