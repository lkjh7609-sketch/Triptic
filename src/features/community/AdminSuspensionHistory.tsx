import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { SUSPENSION_REASONS, type SuspensionReason } from '@/shared/suspension';
import { adminSuspensionHistory, NO_SUSPENSION_FILTER, type AdminSuspensionHistoryFilters } from './adminService';
import { AdminFilterBar } from './AdminFilters';
import styles from './AdminScreen.module.css';
import historyStyles from './AdminSuspensionHistory.module.css';

const PAGE_SIZE = 20;

/**
 * 정지 기록 — 강제 탈퇴로 이용 정지된 이메일의 전체 내역. 정지를 해제해도 기록은 지워지지 않고(DB가 삭제를 막는다) 여기서 계속 볼 수 있다.
 * 검색(이메일·이름·사유 글), 상태(정지 중/해제됨), 사유, 정지일 기간으로 거른다.
 */
export function AdminSuspensionHistory() {
  const { t, i18n } = useTranslation(['community', 'common']);
  const [queryDraft, setQueryDraft] = useState('');
  const [filters, setFilters] = useState<AdminSuspensionHistoryFilters>(NO_SUSPENSION_FILTER);
  const [page, setPage] = useState(0);
  const history = useQuery({
    queryKey: ['admin', 'suspension-history', filters, page],
    queryFn: () => adminSuspensionHistory(filters, page, PAGE_SIZE),
    placeholderData: (prev) => prev, // 쪽·필터를 바꿀 때 목록이 깜빡 사라지지 않게
  });
  const rows = history.data?.rows ?? [];
  const total = history.data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const dt = (iso: string) => new Date(iso).toLocaleString(i18n.language);

  function change(patch: Partial<AdminSuspensionHistoryFilters>) {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  }

  return (
    <div>
      <p className={historyStyles.lead}>{t('admin.suspensionHistory.lead', { ns: 'community' })}</p>
      <AdminFilterBar
        searchValue={queryDraft}
        searchPlaceholder={t('admin.suspensionHistory.searchPlaceholder', { ns: 'community' })}
        onSearchChange={setQueryDraft}
        onSearchSubmit={() => change({ query: queryDraft.trim() })}
        onReset={() => {
          setQueryDraft('');
          setFilters(NO_SUSPENSION_FILTER);
          setPage(0);
        }}
        pills={[
          {
            key: 'status',
            label: t('admin.suspensionHistory.status', { ns: 'community' }),
            value: filters.status,
            onChange: (status) => change({ status: status as AdminSuspensionHistoryFilters['status'] }),
            options: [
              { value: 'active', label: t('admin.suspensionHistory.statusActive', { ns: 'community' }) },
              { value: 'lifted', label: t('admin.suspensionHistory.statusLifted', { ns: 'community' }) },
            ],
          },
          {
            key: 'reason',
            label: t('admin.suspensionHistory.reason', { ns: 'community' }),
            value: filters.reason,
            onChange: (reason) => change({ reason: reason as '' | SuspensionReason }),
            options: SUSPENSION_REASONS.map((r) => ({ value: r, label: t(`suspension.reasons.${r}`, { ns: 'common' }) })),
          },
        ]}
        dateRange={{
          key: 'suspended',
          label: t('admin.suspensionHistory.suspendedOn', { ns: 'community' }),
          from: filters.from,
          to: filters.to,
          fromLabel: t('admin.suspensionHistory.from', { ns: 'community' }),
          toLabel: t('admin.suspensionHistory.to', { ns: 'community' }),
          onChange: (from, to) => change({ from, to }),
        }}
      />

      <p className={historyStyles.total} role="status">
        {t('admin.suspensionHistory.total', { ns: 'community', count: total })}
      </p>

      {history.isLoading ? (
        <Skeleton height="72px" />
      ) : history.isError ? (
        <ErrorState summary={t('admin.suspensionHistory.loadFailed', { ns: 'community' })} onRetry={() => void history.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState message={t('admin.suspensionHistory.empty', { ns: 'community' })} />
      ) : (
        <>
          <ul className={historyStyles.list}>
            {rows.map((s) => (
              <li key={s.id} className={historyStyles.card}>
                <div className={historyStyles.head}>
                  <strong className={historyStyles.email}>{s.email}</strong>
                  <span className={s.lifted_at ? historyStyles.statusLifted : historyStyles.statusActive}>
                    {s.lifted_at ? t('admin.suspensionHistory.statusLifted', { ns: 'community' }) : t('admin.suspensionHistory.statusActive', { ns: 'community' })}
                  </span>
                </div>
                <p className={historyStyles.reason}>
                  {[s.display_name, s.reason === 'custom' && s.reason_text ? s.reason_text : t(`suspension.reasons.${s.reason}`, { ns: 'common' })].filter(Boolean).join(' · ')}
                </p>
                <p className={historyStyles.meta}>
                  {t('admin.suspensionHistory.suspendedAt', { ns: 'community', time: dt(s.suspended_at) })}
                  {s.suspended_by_name ? ` · ${s.suspended_by_name}` : ''}
                </p>
                {s.lifted_at ? (
                  <p className={historyStyles.meta}>
                    {t('admin.suspensionHistory.liftedAt', { ns: 'community', time: dt(s.lifted_at) })}
                    {s.lifted_by_name ? ` · ${s.lifted_by_name}` : ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <div className={styles.pagerRow}>
            <button type="button" className={styles.secondaryBtn} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              {t('admin.prevPage', { ns: 'community' })}
            </button>
            <span className={styles.pagerLabel}>{t('admin.pageLabel', { ns: 'community', page: page + 1 })}</span>
            <button type="button" className={styles.secondaryBtn} disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
              {t('admin.nextPage', { ns: 'community' })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
