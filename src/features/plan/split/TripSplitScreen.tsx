import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { parseISO } from 'date-fns';
import { ArrowRight, ChevronLeft, Pencil, Plus, Trash2, Undo2, Users } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { amountInBase, settleInBase, shareInBase } from '@/shared/utils/expenseSplit';
import { useTrip } from '../hooks/useTrips';
import { SAMPLE_TRIP_ID } from '../sampleTrip';
import { isGuestTripId } from '../guestTrips';
import { formatLocalizedDay } from '../planDateFormat';
import { formatMoney, getCategoryTotalsSeries, getDayTotalsSeries } from '../expenses';
import { CATEGORY_ICON } from '../expenseCategoryIcons';
import { ExpenseChart } from '../ExpenseChart';
import { DoughnutChart } from '../DoughnutChart';
import { PersonAvatar } from './MemberPicker';
import { usePersonLabel } from './usePersonLabel';
import { SplitAddFlow } from './SplitAddFlow';
import { splitsAsExpenses, toCalcExpenses, type Person, type TripSplitExpense } from './splitModel';
import { useTripPeople } from './useTripPeople';
import {
  useAddSplitTransfer,
  useDeleteSplitExpense,
  useDeleteSplitTransfer,
  useTripSplitExpenses,
  useTripSplitTransfers,
} from './tripSplitService';
import styles from './Split.module.css';

/** 일자별 합계는 5일씩 한 쪽 — 경비 창과 같다 */
const DAY_CHART_PAGE_SIZE = 5;

/**
 * 여행 더치페이 — 일행이 같이 보는 한 화면. 함께 쓴 돈을 적으면 '누가 누구에게 얼마'가 자동으로 계산되고,
 * 보낸 돈은 '받았어요/보냈어요'로 체크해 정산에서 뺀다. 경비 화면(내 지출)과 같은 도넛·일자 막대를 쓴다.
 * 확정된(끝난) 여행에서도 쓸 수 있다.
 */
export function TripSplitScreen() {
  const { t, i18n } = useTranslation(['plan', 'common']);
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const meId = user?.id ?? null;
  const isLocal = tripId === SAMPLE_TRIP_ID || isGuestTripId(tripId);
  const { data: trip, isLoading, isError, refetch } = useTrip(isLocal ? undefined : tripId);
  const expensesQuery = useTripSplitExpenses(isLocal ? undefined : tripId);
  const transfersQuery = useTripSplitTransfers(isLocal ? undefined : tripId);
  const expenses = useMemo(() => expensesQuery.data ?? [], [expensesQuery.data]);
  const transfers = useMemo(() => transfersQuery.data ?? [], [transfersQuery.data]);

  const deleteExpense = useDeleteSplitExpense(tripId ?? '');
  const addTransfer = useAddSplitTransfer(tripId ?? '');
  const deleteTransfer = useDeleteSplitTransfer(tripId ?? '');
  const [flow, setFlow] = useState<{ initial?: TripSplitExpense } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    trackScreenView('trip_split');
  }, []);

  const currency = trip?.base_currency ?? 'KRW';
  const ownerId = trip?.owner_id ?? null;

  // 기록에 한 번이라도 나온 사람 id — 지금 멤버가 아니어도 이름·캐릭터를 읽어 오려고
  const mentionedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of expenses) {
      ids.add(e.payer_id);
      e.split_among.forEach((id) => ids.add(id));
    }
    for (const tr of transfers) {
      ids.add(tr.from_user);
      ids.add(tr.to_user);
    }
    return [...ids].sort();
  }, [expenses, transfers]);
  const people = useTripPeople(isLocal ? undefined : tripId, ownerId, meId, mentionedIds);
  const labelOf = usePersonLabel(meId);

  const settlement = useMemo(
    () =>
      settleInBase(
        toCalcExpenses(expenses),
        transfers.filter((x) => x.currency === currency).map((x) => ({ from: x.from_user, to: x.to_user, amount: x.amount })),
        currency,
      ),
    [expenses, transfers, currency],
  );

  const myFigures = useMemo(() => {
    let paid = 0;
    let share = 0;
    for (const calc of toCalcExpenses(expenses)) {
      if (calc.payerId === meId) paid += amountInBase(calc, currency) ?? 0;
      if (meId) share += shareInBase(calc, meId, currency);
    }
    return { paid, share, net: meId ? (settlement.balances[meId] ?? 0) : 0 };
  }, [expenses, meId, currency, settlement]);

  const totalDays = trip?.total_days ?? 1;
  const chartData = useMemo(() => splitsAsExpenses(expenses), [expenses]);
  const byDay = useMemo(() => {
    const groups = new Map<number | null, TripSplitExpense[]>();
    for (const e of expenses) groups.set(e.day_index, [...(groups.get(e.day_index) ?? []), e]);
    return [...groups.entries()].sort(([a], [b]) => (a ?? 1e9) - (b ?? 1e9));
  }, [expenses]);

  const money = (amount: number, cur = currency) => formatMoney(amount, cur, i18n.language);
  const dayTitle = (day: number | null) => {
    if (day === null) return t('split.noDay');
    const base = trip?.start_date ? parseISO(trip.start_date) : null;
    const date = base && !Number.isNaN(base.getTime()) ? formatLocalizedDay(new Date(base.getTime() + (day - 1) * 86_400_000), i18n.language) : '';
    return `${t('day.header', { index: day })}${date ? ` · ${date}` : ''}`;
  };

  // 수정 중인 기록에 남은 나간 일행도 고를 수 있게 목록에 포함
  const pickerPeople = (initial?: TripSplitExpense): Person[] => {
    const list = [...people.members];
    if (initial) {
      for (const id of [initial.payer_id, ...initial.split_among]) {
        if (!list.some((p) => p.id === id)) list.push(people.byId(id));
      }
    }
    return list;
  };

  if (isLocal) {
    return (
      <div className={styles.page}>
        <ScreenHeader title={t('split.title')} onBack={() => navigate(-1)} />
        <EmptyState icon={<Users size={32} />} message={t('split.localOnly')} />
      </div>
    );
  }
  if (isLoading || expensesQuery.isLoading) {
    return (
      <div className={styles.page}>
        <ScreenHeader title={t('split.title')} onBack={() => navigate(-1)} />
        <div className={styles.section}>
          <Skeleton height="96px" />
          <Skeleton height="160px" />
        </div>
      </div>
    );
  }
  if (isError || !trip || expensesQuery.isError) {
    return <ErrorState summary={t('split.loadError')} onRetry={() => { void refetch(); void expensesQuery.refetch(); }} />;
  }

  const soloTrip = people.members.length < 2;
  const lineAction = (from: string, to: string, amount: number) => {
    // 받을 사람은 '받았어요', 보낼 사람은 '보냈어요' — 둘 중 누가 눌러도 같은 기록이 생긴다
    if (meId !== from && meId !== to) return null;
    const label = meId === to ? t('split.settle.received') : t('split.settle.sent');
    return (
      <button
        type="button"
        className={styles.lineBtn}
        disabled={addTransfer.isPending}
        onClick={() =>
          addTransfer.mutate(
            { from, to, amount, currency },
            { onError: () => showToast(t('split.settle.failed')) },
          )
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className={styles.page}>
      <ScreenHeader title={t('split.title')} subtitle={trip.title} onBack={() => navigate(-1)} />

      {soloTrip && expenses.length === 0 ? (
        <EmptyState icon={<Users size={32} />} message={t('split.solo')} />
      ) : (
        <>
          <section className={styles.section} aria-label={t('split.summary.title')}>
            <div className={styles.summary}>
              <Figure label={t('split.summary.total')} value={money(settlement.total)} />
              <Figure label={t('split.summary.paid')} value={money(myFigures.paid)} />
              <Figure label={t('split.summary.share')} value={money(myFigures.share)} />
              <Figure
                label={myFigures.net < 0 ? t('split.summary.toGive') : t('split.summary.toGet')}
                value={money(Math.abs(myFigures.net))}
                tone={myFigures.net < 0 ? 'owe' : myFigures.net > 0 ? 'get' : undefined}
              />
            </div>
            {settlement.unconverted > 0 ? <p className={styles.note}>{t('split.unconverted', { count: settlement.unconverted })}</p> : null}
          </section>

          <section className={styles.section} aria-labelledby="split-settle-title">
            <h2 id="split-settle-title" className={styles.sectionTitle}>
              {t('split.settle.title')}
            </h2>
            {expenses.length === 0 ? (
              <p className={styles.note}>{t('split.settle.nothing')}</p>
            ) : settlement.transfers.length === 0 ? (
              <p className={styles.done}>{t('split.settle.done')}</p>
            ) : (
              <ul className={styles.lines}>
                {settlement.transfers.map((tr) => {
                  const from = people.byId(tr.from);
                  const to = people.byId(tr.to);
                  return (
                    <li key={`${tr.from}-${tr.to}`} className={styles.line}>
                      <span className={`${styles.lineWho} ${styles.lineFrom}`}>
                        <PersonAvatar person={from} pixel={1} />
                        <span className={styles.lineName}>{labelOf(from)}</span>
                      </span>
                      <span className={styles.lineMid}>
                        <ArrowRight size={16} aria-hidden="true" className={styles.arrow} />
                        <span className={styles.lineAmount}>{money(tr.amount)}</span>
                      </span>
                      <span className={`${styles.lineWho} ${styles.lineTo}`}>
                        <PersonAvatar person={to} pixel={1} />
                        <span className={styles.lineName}>{labelOf(to)}</span>
                      </span>
                      {lineAction(tr.from, tr.to, tr.amount)}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {expenses.length > 0 ? (
            <section className={styles.section}>
              <ExpenseChart
                title={t('expense.chartByDay')}
                data={getDayTotalsSeries(chartData, totalDays, currency, (day) => t('day.header', { index: day }))}
                currency={currency}
                pageSize={DAY_CHART_PAGE_SIZE}
              />
              <DoughnutChart
                title={t('expense.chartByCategory')}
                data={getCategoryTotalsSeries(chartData, currency, (cat) => t(`expense.category.${cat}`))}
                currency={currency}
              />
            </section>
          ) : null}

          <section className={styles.section} aria-labelledby="split-list-title">
            <h2 id="split-list-title" className={styles.sectionTitle}>
              {t('split.list.title')}
            </h2>
            {expenses.length === 0 ? <p className={styles.note}>{t('split.list.empty')}</p> : null}
            {byDay.map(([day, list]) => (
              <div key={day ?? 'none'} className={styles.dayGroup}>
                <h3 className={styles.dayTitle}>{dayTitle(day)}</h3>
                <ul className={styles.records}>
                  {list.map((e) => {
                    const payer = people.byId(e.payer_id);
                    const mine = meId ? shareInBase(toCalcExpenses([e])[0], meId, currency) : 0;
                    const inSplit = !!meId && e.split_among.includes(meId);
                    const unconverted = amountInBase(toCalcExpenses([e])[0], currency) === null;
                    return (
                      <li key={e.id} className={styles.record}>
                        <span className={styles.recordIcon}>{CATEGORY_ICON[e.category]}</span>
                        <span className={styles.recordBody}>
                          <span className={styles.recordDesc}>{e.description}</span>
                          <span className={styles.recordMeta}>{t('split.list.paidBy', { name: labelOf(payer) })}</span>
                          <span className={styles.faces} aria-label={t('split.list.splitWith', { count: e.split_among.length })}>
                            {e.split_among.map((id) => (
                              <PersonAvatar key={id} person={people.byId(id)} pixel={1} label={labelOf(people.byId(id))} />
                            ))}
                          </span>
                        </span>
                        <span className={styles.recordAmount}>
                          <span>{money(e.amount, e.currency)}</span>
                          {unconverted ? <span className={styles.recordSub}>{t('expense.unconverted')}</span> : null}
                          {inSplit && !unconverted ? <span className={styles.recordSub}>{t('split.list.myShare', { amount: money(mine) })}</span> : null}
                        </span>
                        {meId && e.created_by === meId ? (
                          <span className={styles.recordActions}>
                            <button type="button" className={styles.iconBtn} aria-label={t('action.edit', { ns: 'common' })} onClick={() => setFlow({ initial: e })}>
                              <Pencil size={15} aria-hidden="true" />
                            </button>
                            <button type="button" className={styles.iconBtn} aria-label={t('action.delete', { ns: 'common' })} onClick={() => setConfirmDelete(e.id)}>
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

          {transfers.length > 0 ? (
            <section className={styles.section} aria-labelledby="split-transfers-title">
              <h2 id="split-transfers-title" className={styles.sectionTitle}>
                {t('split.transfers.title')}
              </h2>
              <ul className={styles.records}>
                {transfers.map((tr) => (
                  <li key={tr.id} className={styles.record}>
                    <span className={styles.recordBody}>
                      <span className={styles.recordDesc}>
                        {t('split.transfers.line', { from: labelOf(people.byId(tr.from_user)), to: labelOf(people.byId(tr.to_user)) })}
                      </span>
                      <span className={styles.recordMeta}>{formatLocalizedDay(new Date(tr.created_at), i18n.language)}</span>
                    </span>
                    <span className={styles.recordAmount}>{money(tr.amount, tr.currency)}</span>
                    {meId && tr.created_by === meId ? (
                      <button
                        type="button"
                        className={styles.iconBtn}
                        aria-label={t('split.transfers.cancel')}
                        disabled={deleteTransfer.isPending}
                        onClick={() => deleteTransfer.mutate(tr.id, { onError: () => showToast(t('split.settle.failed')) })}
                      >
                        <Undo2 size={15} aria-hidden="true" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {!soloTrip ? (
        <div className={styles.addBar}>
          <button type="button" className={styles.addBtn} onClick={() => setFlow({})}>
            <Plus size={18} aria-hidden="true" /> {t('split.add')}
          </button>
        </div>
      ) : null}

      {flow ? (
        <SplitAddFlow
          tripId={trip.id}
          people={pickerPeople(flow.initial)}
          meId={meId}
          currency={currency}
          totalDays={totalDays}
          defaultDay={null}
          initial={flow.initial}
          onClose={() => setFlow(null)}
        />
      ) : null}

      {confirmDelete ? (
        <ConfirmDialog
          title={t('split.deleteTitle')}
          message={t('split.deleteConfirm')}
          cancelLabel={t('split.deleteKeep')}
          confirmLabel={t('split.deleteProceed')}
          danger
          onConfirm={() => deleteExpense.mutate(confirmDelete, { onError: () => showToast(t('split.flow.saveFailed')) })}
          onClose={() => setConfirmDelete(null)}
        />
      ) : null}
    </div>
  );
}

function ScreenHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  const { t } = useTranslation('plan');
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} aria-label={t('tripDetail.backAria')} onClick={onBack}>
        <ChevronLeft size={22} aria-hidden="true" />
      </button>
      <div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </header>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'get' | 'owe' }) {
  return (
    <div className={styles.figure}>
      <span className={styles.figureLabel}>{label}</span>
      <span className={tone === 'get' ? styles.figureGet : tone === 'owe' ? styles.figureOwe : styles.figureValue}>{value}</span>
    </div>
  );
}
