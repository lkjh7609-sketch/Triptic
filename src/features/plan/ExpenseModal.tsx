import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,

  convertToBase,
  formatMoney,
  getCategoryTotalsSeries,
  getDayExpenseTotal,
  getDayTotalsSeries,
  getGrandExpenseTotal,
} from './expenses';
import { ExpenseChart } from './ExpenseChart';
import { DoughnutChart } from './DoughnutChart';
import { CATEGORY_ICON } from './expenseCategoryIcons';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { flagInvalid } from '@/shared/ui/invalidField';
import type { ExpenseCategory, ExpenseItem, ExpensePaymentMethod, ExpensesData } from './types';
import { SplitAddFlow } from './split/SplitAddFlow';
import { myEntries, type MyExpenseItem } from './split/splitModel';
import { usePersonLabel } from './split/usePersonLabel';
import type { TripPeople } from './split/useTripPeople';
import styles from './ExpenseModal.module.css';
import splitStyles from './split/Split.module.css';
import modalStyles from './AddPlaceModal.module.css';
import { Coins, Plus, Users, User } from 'lucide-react';

interface ExpenseModalProps {
  currentDay: number;
  totalDays: number;
  currency: string;
  /** 이 여행의 모든 경비(일행 것 포함) — 저장은 늘 이 전체 목록 기준이라 일행 것이 지워지지 않는다 */
  expensesData: ExpensesData;
  onClose: () => void;
  onSave: (dayExpenses: ExpenseItem[]) => Promise<void>;
  /** 여행 시작일(yyyy-MM-dd) — 더치페이 날짜 고르기에서 일차 옆에 날짜를 보여 준다 */
  startDate?: string | null;
  /** 내 지출(혼자 쓴 돈 + 내 더치페이 몫) — 합계·그래프·목록의 기준. 없으면 전체 경비가 내 것 */
  myExpenses?: Record<number, MyExpenseItem[]>;
  /** 로그인 전·임시 여행처럼 모르면 비워 둔다 — 이때는 모든 경비가 내 것 */
  meId?: string | null;
  ownerId?: string | null;
  /** 있으면 일행과 가는 여행 — 경비를 추가할 때 혼자 쓴 돈인지 더치페이인지 먼저 묻는다 */
  split?: { tripId: string; people: TripPeople; onOpenSplit: () => void };
}

/** 일자별 합계는 5일씩 한 쪽 — 옆으로 넘긴다 */
const DAY_CHART_PAGE_SIZE = 5;

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
export function ExpenseModal({ currentDay, totalDays, currency, expensesData, onClose, onSave, startDate, myExpenses: myExpensesProp, meId = null, ownerId = null, split }: ExpenseModalProps) {
  const myExpenses: Record<number, MyExpenseItem[]> = myExpensesProp ?? expensesData;
  const { t, i18n } = useTranslation(['plan', 'common']);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [paymentMethod, _setPaymentMethod] = useState<ExpensePaymentMethod | ''>('');
  const [saving, setSaving] = useState(false);
  // 일행과 가는 여행은 '+ 경비 추가'를 눌러 종류를 고른 뒤에야 입력칸이 열린다. 혼자 가는 여행은 예전처럼 처음부터 열려 있다
  const [formOpen, setFormOpen] = useState(!split);
  const [kindOpen, setKindOpen] = useState(false);
  const [splitFlowOpen, setSplitFlowOpen] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const descRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const labelOf = usePersonLabel(meId);

  /** 이 날의 전체 목록(일행 것 포함) — 저장·삭제는 이 목록과 원래 순번으로 한다 */
  const list = expensesData[currentDay] ?? [];
  const mineEntries = myEntries(list, meId, ownerId);
  /** 내가 나눈 더치페이의 내 몫 줄(읽기 전용) */
  const shareRows = (myExpenses[currentDay] ?? []).filter((e) => e.split);
  const dayList = myExpenses[currentDay] ?? [];
  const dayTotal = getDayExpenseTotal(dayList, currency);
  const grandTotal = getGrandExpenseTotal(myExpenses, currency);
  const currSymbol = (CURRENCIES[currency] ?? CURRENCIES.KRW).symbol;

  function unconvertedNote(count: number): string {
    return count > 0 ? ` ${t('expense.unconvertedCount', { count })}` : '';
  }

  async function handleAdd() {
    const amountNum = Number(amount);
    if (!desc.trim() || !amountNum) {
      flagInvalid(!desc.trim() ? descRef.current : null, !amountNum ? amountRef.current : null);
      return;
    }
    setSaving(true);
    try {
      // 통화는 여행 통화로 고정 — 여행 도시에서 자동 지정되므로 입력할 때 고르지 않는다
      const newItem: ExpenseItem = {
        desc: desc.trim(),
        amount: amountNum,
        currency,
        category,
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(meId ? { paidBy: meId } : {}),
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
    <div className={modalStyles.overlay}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('expense.title')}
      >
        <h2 className={modalStyles.title}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><Coins size={18} /> {t('expense.title')}</span></h2>

        {split ? (
          <p className={splitStyles.mineNote}>
            <span>{t('expense.mineNote')}</span>
            <button type="button" className={splitStyles.linkBtn} onClick={split.onOpenSplit}>
              {t('expense.openSplit')}
            </button>
          </p>
        ) : null}

        {split && !formOpen ? (
          <button type="button" className={splitStyles.newBtn} onClick={() => setKindOpen(true)}>
            <Plus size={18} aria-hidden="true" /> {t('expense.add')}
          </button>
        ) : null}

        {formOpen ? (
        <>
        <div className={styles.addRow}>
          <input
            ref={descRef}
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
                <span className={styles.categoryLabel}>{t(`expense.category.${cat}`)}</span>
              </button>
            ))}
          </div>
          <div className={styles.detailsRow}>
            <input
              ref={amountRef}
              className={styles.amountInput}
              type="number"
              placeholder={t('expense.amountPlaceholder', { symbol: currSymbol })}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <button type="button" className={styles.addBtn} disabled={saving} onClick={handleAdd}>
              {t('action.add', { ns: 'common' })}
            </button>
          </div>
        </div>
        </>
        ) : null}
        <div className={styles.list}>
          {mineEntries.length === 0 && shareRows.length === 0 ? (
            <p className={styles.empty}>{t('expense.empty')}</p>
          ) : null}
          {shareRows.map((e) => {
            const payer = split?.people.byId(e.split!.payerId);
            const body = (
              <>
                <span className={styles.itemIcon}>{CATEGORY_ICON[e.category ?? 'other']}</span>
                <span className={styles.itemDesc}>
                  <span className={styles.itemMeta}>{t(`expense.category.${e.category ?? 'other'}`)} · </span>
                  {e.desc}
                  <span className={splitStyles.badge}>{t('expense.splitBadge')}</span>
                  <span className={splitStyles.shareMeta}>
                    {t('expense.splitMeta', { count: e.split!.people, name: payer ? labelOf(payer) : '' })}
                  </span>
                </span>
                <span className={styles.itemAmount}>
                  {formatMoney(e.amount, e.currency ?? currency, i18n.language)}
                  {(e.currency ?? currency) !== currency ? <span className={styles.itemConverted}> ({t('expense.unconverted')})</span> : null}
                </span>
              </>
            );
            return split ? (
              <button key={`s-${e.split!.id}`} type="button" className={`${styles.listItem} ${splitStyles.shareRow}`} onClick={split.onOpenSplit}>
                {body}
              </button>
            ) : (
              <div key={`s-${e.split!.id}`} className={styles.listItem}>
                {body}
              </div>
            );
          })}
          {mineEntries.map(({ item: e, index: i }) => {
              const itemCur = e.currency ?? currency;
              const converted = convertToBase(e, currency);
              return (
                <div key={i} className={styles.listItem}>
                  <span className={styles.itemIcon}>{CATEGORY_ICON[e.category ?? 'other']}</span>
                  <span className={styles.itemDesc}>
                    <span className={styles.itemMeta}>{t(`expense.category.${e.category ?? 'other'}`)} · </span>
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
          })}
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
          data={getDayTotalsSeries(myExpenses, totalDays, currency, (day) => t('day.header', { index: day }))}
          currency={currency}
          pageSize={DAY_CHART_PAGE_SIZE}
        />
        <DoughnutChart
          title={t('expense.chartByCategory')}
          data={getCategoryTotalsSeries(myExpenses, currency, (cat) => t(`expense.category.${cat}`))}
          currency={currency}
        />

        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primary} onClick={onClose}>
            {t('action.close', { ns: 'common' })}
          </button>
        </div>
      </div>

      {kindOpen ? (
        <div className={splitStyles.kindOverlay} onClick={() => setKindOpen(false)}>
          <div className={splitStyles.kindCard} role="dialog" aria-modal="true" aria-label={t('expense.choice.title')} onClick={(e) => e.stopPropagation()}>
            <h3 className={splitStyles.kindTitle}>{t('expense.choice.title')}</h3>
            <button
              type="button"
              className={splitStyles.kindBtn}
              onClick={() => {
                setKindOpen(false);
                setFormOpen(true);
              }}
            >
              <span className={splitStyles.kindName}>
                <User size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                {t('expense.choice.solo')}
              </span>
              <span className={splitStyles.kindSub}>{t('expense.choice.soloSub')}</span>
            </button>
            <button
              type="button"
              className={splitStyles.kindBtn}
              onClick={() => {
                setKindOpen(false);
                setSplitFlowOpen(true);
              }}
            >
              <span className={splitStyles.kindName}>
                <Users size={16} aria-hidden="true" style={{ verticalAlign: '-3px', marginRight: 6 }} />
                {t('expense.choice.split')}
              </span>
              <span className={splitStyles.kindSub}>{t('expense.choice.splitSub')}</span>
            </button>
          </div>
        </div>
      ) : null}

      {splitFlowOpen && split ? (
        <SplitAddFlow
          tripId={split.tripId}
          people={split.people.members}
          meId={meId}
          currency={currency}
          totalDays={totalDays}
          startDate={startDate}
          defaultDay={currentDay}
          onClose={() => setSplitFlowOpen(false)}
        />
      ) : null}
    </div>
  );
}
