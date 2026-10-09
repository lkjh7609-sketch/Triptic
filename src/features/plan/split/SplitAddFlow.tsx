import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseISO } from 'date-fns';
import { Users } from 'lucide-react';
import { formatLocalizedDay } from '../planDateFormat';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { flagInvalid } from '@/shared/ui/invalidField';
import { showToast } from '@/shared/ui/toast';
import { CURRENCIES, EXPENSE_CATEGORIES, formatMoney } from '../expenses';
import { CATEGORY_ICON } from '../expenseCategoryIcons';
import type { ExpenseCategory } from '../types';
import { MemberPicker } from './MemberPicker';
import { isRealSplit, type Person, type TripSplitExpense } from './splitModel';
import { useAddSplitExpense, useUpdateSplitExpense } from './tripSplitService';
import expenseStyles from '../ExpenseModal.module.css';
import modalStyles from '../AddPlaceModal.module.css';
import styles from './Split.module.css';

interface SplitAddFlowProps {
  tripId: string;
  /** 고를 수 있는 사람 — 지금 멤버(수정할 때는 기록에 남은 나간 일행 포함) */
  people: Person[];
  meId: string | null;
  /** 여행 기본 통화 */
  currency: string;
  totalDays: number;
  /** 여행 시작일(yyyy-MM-dd) — 일차 옆에 날짜를 보여 주는 데 쓴다 */
  startDate?: string | null;
  /** 새로 적을 때 기본으로 둘 일차(없으면 날짜 없음) */
  defaultDay: number | null;
  /** 있으면 이 기록을 고친다 */
  initial?: TripSplitExpense;
  onClose: () => void;
}

/**
 * 더치페이 추가·수정 — ① 누구와 나눌지(도트 캐릭터 + 이름으로 고름, 3명이 가도 2명만 나눌 수 있다)
 * → ② 분류·메모·금액·돈 낸 사람. 저장하면 정산 계산이 자동으로 다시 된다.
 */
export function SplitAddFlow({ tripId, people, meId, currency, totalDays, startDate, defaultDay, initial, onClose }: SplitAddFlowProps) {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const add = useAddSplitExpense(tripId);
  const update = useUpdateSplitExpense(tripId);
  const descRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [splitAmong, setSplitAmong] = useState<string[]>(initial?.split_among ?? people.map((p) => p.id));
  const [payerId, setPayerId] = useState<string>(initial?.payer_id ?? meId ?? people[0]?.id ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? 'other');
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [day, setDay] = useState<number | null>(initial ? initial.day_index : defaultDay);
  const [error, setError] = useState<string | null>(null);

  // 수정할 때는 처음 적은 통화를 그대로 둔다(환율 스냅샷도 그대로)
  const money = initial?.currency ?? currency;
  const symbol = (CURRENCIES[money] ?? CURRENCIES.KRW).symbol;
  const amountNum = Number(amount);
  const saving = add.isPending || update.isPending;
  // 'Day 1 · 11/5 (목)' — 일차만 보면 어느 날인지 헷갈려서 날짜를 같이 보여 준다
  const dayLabel = (d: number) => {
    const base = startDate ? parseISO(startDate) : null;
    const date = base && !Number.isNaN(base.getTime()) ? formatLocalizedDay(new Date(base.getTime() + (d - 1) * 86_400_000), i18n.language) : '';
    return `${t('day.header', { index: d })}${date ? ` · ${date}` : ''}`;
  };

  async function handleSave() {
    if (!desc.trim() || !(amountNum > 0)) {
      flagInvalid(!desc.trim() ? descRef.current : null, !(amountNum > 0) ? amountRef.current : null);
      return;
    }
    if (!isRealSplit(payerId, splitAmong)) {
      setError(t('split.flow.errAlone'));
      return;
    }
    setError(null);
    const input = {
      dayIndex: day,
      category,
      description: desc.trim(),
      amount: amountNum,
      currency: money,
      fxRateToBase: initial?.fx_rate_to_base ?? null,
      payerId,
      splitAmong,
    };
    try {
      if (initial) await update.mutateAsync({ id: initial.id, input });
      else await add.mutateAsync(input);
      showToast(t('split.flow.saved'));
      onClose();
    } catch {
      showToast(t('split.flow.saveFailed'));
    }
  }

  return (
    <div className={`${modalStyles.overlay} ${styles.flowOverlay}`}>
      <div
        ref={trapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('split.flow.title')}
      >
        <h2 className={modalStyles.title}>
          <span className={styles.titleRow}>
            <Users size={18} /> {initial ? t('split.flow.editTitle') : t('split.flow.title')}
          </span>
        </h2>

        {step === 1 ? (
          <>
            <h3 className={styles.stepTitle}>{t('split.flow.step1')}</h3>
            <p className={styles.hint}>{t('split.flow.step1Hint')}</p>
            <MemberPicker people={people} meId={meId} selected={splitAmong} onChange={setSplitAmong} mode="multi" ariaLabel={t('split.flow.step1')} />
            <p className={styles.count}>{t('split.flow.picked', { count: splitAmong.length })}</p>
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} onClick={onClose}>
                {t('action.cancel', { ns: 'common' })}
              </button>
              <button type="button" className={modalStyles.primary} disabled={splitAmong.length === 0} onClick={() => setStep(2)}>
                {t('split.flow.next')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className={styles.stepTitle}>{t('split.flow.step2')}</h3>
            <div className={styles.flowFields}>
              <div className={expenseStyles.categoryRow} role="radiogroup" aria-label={t('expense.categoryAria')}>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    role="radio"
                    aria-checked={category === cat}
                    className={category === cat ? expenseStyles.categoryBtnActive : expenseStyles.categoryBtn}
                    onClick={() => setCategory(cat)}
                    title={t(`expense.category.${cat}`)}
                  >
                    {CATEGORY_ICON[cat]}
                    <span className={expenseStyles.categoryLabel}>{t(`expense.category.${cat}`)}</span>
                  </button>
                ))}
              </div>
              <input
                ref={descRef}
                className={styles.textField}
                placeholder={t('split.flow.descPlaceholder')}
                value={desc}
                maxLength={100}
                onChange={(e) => setDesc(e.target.value)}
              />
              <input
                ref={amountRef}
                className={styles.textField}
                type="number"
                inputMode="decimal"
                placeholder={t('expense.amountPlaceholder', { symbol })}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amountNum > 0 && splitAmong.length > 0 ? (
                <p className={styles.hint}>
                  {t('split.flow.perPerson', { amount: formatMoney(amountNum / splitAmong.length, money, i18n.language) })}
                </p>
              ) : null}
            </div>

            <h3 className={styles.stepTitle}>{t('split.flow.payer')}</h3>
            <MemberPicker
              people={people}
              meId={meId}
              selected={payerId ? [payerId] : []}
              onChange={(ids) => setPayerId(ids[0] ?? '')}
              mode="single"
              ariaLabel={t('split.flow.payer')}
            />

            <label className={styles.dayField}>
              <span className={styles.fieldLabel}>{t('split.flow.day')}</span>
              <select className={styles.daySelect} value={day ?? ''} onChange={(e) => setDay(e.target.value ? Number(e.target.value) : null)}>
                <option value="">{t('split.noDay')}</option>
                {Array.from({ length: Math.max(1, totalDays) }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {dayLabel(d)}
                  </option>
                ))}
              </select>
            </label>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} disabled={saving} onClick={() => setStep(1)}>
                {t('split.flow.back')}
              </button>
              <button type="button" className={modalStyles.primary} disabled={saving || !payerId} onClick={handleSave}>
                {t('action.save', { ns: 'common' })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
