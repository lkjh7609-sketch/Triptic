import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Plus, Receipt, Trash2 } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile } from '@/shared/hooks/useProfile';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { CURRENCIES, currencyName } from '@/features/plan/expenses';
import { useCompanionMatchMembers, useCompanionPost } from './hooks/useCompanionPosts';
import { useAddCompanionExpense, useCompanionExpenses, useDeleteCompanionExpense } from './companionExpenseService';
import { settleExpenses } from './expenseSplit';
import postDetailStyles from './PostDetailScreen.module.css';
import styles from './CompanionExpensesScreen.module.css';

function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

/** 동행 경비 나누기(0053) — 모임 멤버가 쓴 돈을 기록하고 통화별로 "누가 누구에게 얼마"를 보여준다 */
export function CompanionExpensesScreen() {
  const { t, i18n } = useTranslation(['community', 'common']);
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const { data: post, isLoading, isError, refetch } = useCompanionPost(postId, user?.id ?? null);
  const membersQuery = useCompanionMatchMembers(post);
  const expensesQuery = useCompanionExpenses(postId);
  const addExpense = useAddCompanionExpense(postId ?? '');
  const deleteExpense = useDeleteCompanionExpense(postId ?? '');

  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyChoice, setCurrency] = useState<string | null>(null);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [splitAmong, setSplitAmong] = useState<string[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    trackScreenView('community_companion_expenses');
  }, []);

  // 기본값: 결제자는 나, 나눌 사람은 멤버 전원(멤버 목록이 늦게 와서 선택 전엔 파생값으로)
  const effectivePayer = payerId ?? user?.id ?? '';
  const currency = currencyChoice ?? profile?.base_currency ?? 'KRW';
  const effectiveSplit = splitAmong ?? members.map((m) => m.user_id);
  const nameOf = (id: string) => {
    const m = members.find((x) => x.user_id === id);
    return m ? m.profile?.display_name || t('post.fallbackAuthor') : t('companion.expenses.formerMember');
  };

  const settlements = useMemo(
    () =>
      settleExpenses(
        (expensesQuery.data ?? []).map((e) => ({ payerId: e.payer_id, amount: e.amount, currency: e.currency, splitAmong: e.split_among })),
      ),
    [expensesQuery.data],
  );

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="160px" />
      </div>
    );
  }
  if (isError || !post || (post.status !== 'matched' && post.status !== 'closed')) {
    return <ErrorState summary={t('companion.match.loadError')} onRetry={() => refetch()} />;
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    const value = Number(amount.replace(/,/g, ''));
    if (!description.trim() || !(value > 0) || effectiveSplit.length === 0 || !effectivePayer) {
      setErrorMessage(t('companion.expenses.invalid'));
      return;
    }
    try {
      await addExpense.mutateAsync({ payerId: effectivePayer, amount: value, currency, description: description.trim(), splitAmong: effectiveSplit });
      setDescription('');
      setAmount('');
      setShowForm(false);
    } catch (err) {
      captureError(err, { context: 'addCompanionExpense' });
      setErrorMessage(t('companion.expenses.saveError'));
    }
  }

  function toggleSplit(id: string) {
    const cur = effectiveSplit;
    setSplitAmong(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  return (
    <div className={postDetailStyles.wrap}>
      <button type="button" className={postDetailStyles.backBtn} onClick={() => navigate(-1)}>
        ← {t('action.back', { ns: 'common' })}
      </button>

      <header className={styles.header}>
        <h2 className={styles.title}>
          <Receipt size={20} aria-hidden="true" /> {t('companion.expenses.title')}
        </h2>
        <p className={styles.subtitle}>{post.title}</p>
      </header>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('companion.expenses.settlement')}</h3>
        {expensesQuery.isLoading ? (
          <Skeleton height="60px" />
        ) : settlements.length === 0 ? (
          <p className={styles.muted}>{t('companion.expenses.noExpenses')}</p>
        ) : (
          settlements.map((s) => (
            <div key={s.currency} className={styles.settleCard}>
              <div className={styles.settleHead}>
                <span>{currencyName(s.currency, i18n.language)}</span>
                <span className={styles.muted}>{t('companion.expenses.total', { amount: formatMoney(s.total, s.currency, i18n.language) })}</span>
              </div>
              {s.transfers.length === 0 ? (
                <p className={styles.muted}>{t('companion.expenses.settled')}</p>
              ) : (
                <ul className={styles.transferList}>
                  {s.transfers.map((tr) => (
                    <li key={`${tr.from}-${tr.to}`} className={styles.transferRow}>
                      <span className={tr.from === user?.id ? styles.me : undefined}>{nameOf(tr.from)}</span>
                      <ArrowRight size={14} aria-hidden="true" className={styles.arrow} />
                      <span className={tr.to === user?.id ? styles.me : undefined}>{nameOf(tr.to)}</span>
                      <span className={styles.transferAmount}>{formatMoney(tr.amount, s.currency, i18n.language)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </section>

      <section className={styles.section}>
        {showForm ? (
          <form className={styles.form} onSubmit={handleAdd}>
            <input
              className={styles.input}
              placeholder={t('companion.expenses.descriptionPlaceholder')}
              aria-label={t('companion.expenses.descriptionPlaceholder')}
              value={description}
              maxLength={100}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className={styles.amountRow}>
              <input
                className={styles.input}
                inputMode="decimal"
                placeholder={t('companion.expenses.amountPlaceholder')}
                aria-label={t('companion.expenses.amountPlaceholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <select className={styles.select} value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label={t('companion.expenses.currency')}>
                {Object.keys(CURRENCIES).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <label className={styles.fieldLabel}>
              {t('companion.expenses.paidBy')}
              <select className={styles.select} value={effectivePayer} onChange={(e) => setPayerId(e.target.value)}>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile?.display_name || t('post.fallbackAuthor')}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={styles.splitFieldset}>
              <legend className={styles.fieldLabel}>{t('companion.expenses.splitAmong')}</legend>
              <div className={styles.splitChips}>
                {members.map((m) => {
                  const on = effectiveSplit.includes(m.user_id);
                  return (
                    <button
                      key={m.user_id}
                      type="button"
                      aria-pressed={on}
                      className={on ? styles.chipOn : styles.chip}
                      onClick={() => toggleSplit(m.user_id)}
                    >
                      {m.profile?.display_name || t('post.fallbackAuthor')}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
            <div className={styles.formActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setShowForm(false)}>
                {t('action.cancel', { ns: 'common' })}
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={addExpense.isPending}>
                {t('companion.expenses.add')}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className={styles.addBtn} onClick={() => setShowForm(true)}>
            <Plus size={16} aria-hidden="true" /> {t('companion.expenses.addTitle')}
          </button>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t('companion.expenses.list')}</h3>
        {(expensesQuery.data ?? []).length === 0 ? (
          <EmptyState message={t('companion.expenses.noExpenses')} />
        ) : (
          <ul className={styles.expenseList}>
            {(expensesQuery.data ?? []).map((e) => (
              <li key={e.id} className={styles.expenseRow}>
                <div className={styles.expenseMain}>
                  <span className={styles.expenseDesc}>{e.description}</span>
                  <span className={styles.muted}>
                    {t('companion.expenses.paidSplit', { name: nameOf(e.payer_id), count: e.split_among.length })}
                  </span>
                </div>
                <span className={styles.expenseAmount}>{formatMoney(e.amount, e.currency, i18n.language)}</span>
                {e.created_by === user?.id ? (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    aria-label={t('action.delete', { ns: 'common' })}
                    disabled={deleteExpense.isPending}
                    onClick={() => deleteExpense.mutate(e.id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
