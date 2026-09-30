import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Lock as LockIcon, Search } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { isAdmin } from './communityService';
import {
  adminListFeedback,
  adminMarkFeedbackReviewed,
  adminSearchUsers,
  adminSetUserPlan,
  BASE_FREE_TRIP_LIMIT,
  getFeedbackScreenshotSignedUrl,
  getReportTargetPreview,
  listOpenReports,
  listPendingReviewCompanionPosts,
  listPendingReviewPosts,
  resolveReport,
  setCommentStatus,
  setCompanionApplicationStatus,
  setCompanionMessageStatus,
  setCompanionPostStatus,
  setPostStatus,
  type AdminFeedbackRow,
  type AdminUserRow,
} from './adminService';
import type { Report } from './types';
import { AdminSalesTab } from './AdminSalesTab';
import styles from './AdminScreen.module.css';

type Tab = 'reports' | 'pending' | 'users' | 'feedback' | 'sales';

function UserPlanRow({ user, onChanged }: { user: AdminUserRow; onChanged: (user: AdminUserRow) => void }) {
  const { t } = useTranslation(['community', 'common']);
  const [busy, setBusy] = useState(false);

  async function handleToggle() {
    const nextPlan = user.plan === 'pro' ? 'free' : 'pro';
    setBusy(true);
    try {
      await adminSetUserPlan(user.id, nextPlan);
      onChanged({ ...user, plan: nextPlan });
    } catch (err) {
      captureError(err, { context: 'adminSetUserPlan' });
      window.alert(t('admin.planChangeError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.item}>
      <div className={styles.userRow}>
        <div className={styles.userInfo}>
          <span className={styles.userHandle}>@{user.handle || t('admin.userNoHandle')}</span>
          <span className={styles.userName}>{user.display_name || t('admin.userNoName')}</span>
          <span className={user.plan === 'pro' ? styles.planBadgePro : styles.planBadgeFree}>
            {user.plan === 'pro' ? t('admin.planPro') : t('admin.planFree')}
          </span>
          <span className={styles.tripUsage}>
            {user.plan === 'pro'
              ? t('admin.tripUsagePro', { used: user.trips_created_count })
              : t('admin.tripUsageFree', { used: user.trips_created_count, limit: user.trip_limit })}
            {user.plan === 'free' && user.trip_limit > BASE_FREE_TRIP_LIMIT ? (
              <span className={styles.relaxedBadge}>{t('admin.tripLimitRelaxed', { limit: user.trip_limit, base: BASE_FREE_TRIP_LIMIT })}</span>
            ) : null}
          </span>
        </div>
        <button type="button" className={user.plan === 'pro' ? styles.secondaryBtn : styles.primaryBtn} disabled={busy} onClick={handleToggle}>
          {user.plan === 'pro' ? t('admin.revokePro') : t('admin.grantPro')}
        </button>
      </div>
    </div>
  );
}

const USER_PAGE_SIZE = 20;

function UserPlanTab() {
  const { t } = useTranslation(['community', 'common']);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(0);
  const usersQuery = useQuery({
    queryKey: ['admin', 'user-search', submittedQuery, page],
    queryFn: () => adminSearchUsers(submittedQuery, page, USER_PAGE_SIZE),
  });
  const [overrides, setOverrides] = useState<Record<string, AdminUserRow>>({});

  const displayedRows = (usersQuery.data?.rows ?? []).map((r) => overrides[r.id] ?? r);

  function handleSearch() {
    setOverrides({});
    setPage(0);
    setSubmittedQuery(query.trim());
  }

  return (
    <div>
      <div className={styles.searchRow}>
        <input
          className={styles.searchInput}
          placeholder={t('admin.userSearchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
        />
        <button type="button" className={styles.primaryBtn} onClick={handleSearch}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Search size={16} /> {t('admin.userSearchButton')}</span>
        </button>
      </div>

      {usersQuery.isLoading ? (
        <Skeleton height="60px" />
      ) : displayedRows.length === 0 ? (
        <EmptyState message={t('admin.userSearchEmpty')} />
      ) : (
        <>
          <div className={styles.list}>
            {displayedRows.map((u) => (
              <UserPlanRow
                key={u.id}
                user={u}
                onChanged={(updated) => setOverrides((prev) => ({ ...prev, [updated.id]: updated }))}
              />
            ))}
          </div>
          <div className={styles.pagerRow}>
            <button type="button" className={styles.secondaryBtn} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              {t('admin.prevPage')}
            </button>
            <span className={styles.pagerLabel}>{t('admin.pageLabel', { page: page + 1 })}</span>
            <button
              type="button"
              className={styles.secondaryBtn}
              disabled={!usersQuery.data?.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('admin.nextPage')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FeedbackRow({ item, onChanged }: { item: AdminFeedbackRow; onChanged: (item: AdminFeedbackRow) => void }) {
  const { t } = useTranslation(['community', 'common']);
  const [busy, setBusy] = useState(false);

  // iOS Safari는 await 뒤에 여는 window.open()을 팝업으로 막는다 — 클릭
  // 즉시 반응하는 실제 <a href>가 되도록 signed URL을 미리 받아둔다.
  const screenshotQuery = useQuery({
    queryKey: ['admin', 'feedback-screenshot', item.screenshot_path],
    queryFn: () => getFeedbackScreenshotSignedUrl(item.screenshot_path!),
    enabled: !!item.screenshot_path,
    staleTime: 5 * 60 * 1000,
  });

  async function handleMarkReviewed() {
    setBusy(true);
    try {
      await adminMarkFeedbackReviewed(item.id);
      onChanged({ ...item, status: 'reviewed' });
    } catch (err) {
      captureError(err, { context: 'adminMarkFeedbackReviewed' });
      window.alert(t('admin.markReviewedError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.item}>
      <div className={styles.itemMeta}>
        <span className={styles.userName}>{item.display_name || t('admin.userNoName')}</span>
        <span className={styles.itemTime}>{new Date(item.created_at).toLocaleString('ko-KR')}</span>
        {item.status === 'new' ? <span className={styles.badge}>{t('admin.feedbackStatusNew')}</span> : null}
      </div>
      <p className={styles.preview}>{item.body}</p>
      {item.screenshot_path && screenshotQuery.data ? (
        <a href={screenshotQuery.data} target="_blank" rel="noopener noreferrer" className={styles.screenshotThumbLink}>
          <img src={screenshotQuery.data} alt={t('admin.viewScreenshot')} className={styles.screenshotThumb} />
        </a>
      ) : null}
      <div className={styles.actions}>
        {item.status === 'new' ? (
          <button type="button" className={styles.primaryBtn} disabled={busy} onClick={handleMarkReviewed}>
            {t('admin.markReviewed')}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const FEEDBACK_PAGE_SIZE = 20;

function FeedbackTab() {
  const { t } = useTranslation(['community', 'common']);
  const [page, setPage] = useState(0);
  const feedbackQuery = useQuery({
    queryKey: ['admin', 'feedback', page],
    queryFn: () => adminListFeedback(page, FEEDBACK_PAGE_SIZE),
  });
  const [overrides, setOverrides] = useState<Record<string, AdminFeedbackRow>>({});

  const displayedRows = (feedbackQuery.data?.rows ?? []).map((r) => overrides[r.id] ?? r);

  if (feedbackQuery.isLoading) {
    return <Skeleton height="60px" />;
  }
  if (displayedRows.length === 0) {
    return <EmptyState message={t('admin.feedbackEmpty')} />;
  }
  return (
    <>
      <div className={styles.list}>
        {displayedRows.map((item) => (
          <FeedbackRow
            key={item.id}
            item={item}
            onChanged={(updated) => setOverrides((prev) => ({ ...prev, [updated.id]: updated }))}
          />
        ))}
      </div>
      <div className={styles.pagerRow}>
        <button type="button" className={styles.secondaryBtn} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          {t('admin.prevPage')}
        </button>
        <span className={styles.pagerLabel}>{t('admin.pageLabel', { page: page + 1 })}</span>
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={!feedbackQuery.data?.hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          {t('admin.nextPage')}
        </button>
      </div>
    </>
  );
}

function ReportRow({ report, onResolved }: { report: Report; onResolved: () => void }) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const { data: preview } = useQuery({
    queryKey: ['admin', 'report-preview', report.id],
    queryFn: () => getReportTargetPreview(report.target_type, report.target_id),
  });
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    setBusy(true);
    try {
      if (report.target_type === 'post') await setPostStatus(report.target_id, 'removed');
      else if (report.target_type === 'comment') await setCommentStatus(report.target_id, 'removed');
      else if (report.target_type === 'companion_post') await setCompanionPostStatus(report.target_id, 'removed');
      else if (report.target_type === 'companion_application') await setCompanionApplicationStatus(report.target_id, 'removed');
      else if (report.target_type === 'companion_message') await setCompanionMessageStatus(report.target_id, 'removed');
      await resolveReport(report.id, 'actioned', user!.id);
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    try {
      await resolveReport(report.id, 'dismissed', user!.id);
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.item}>
      <div className={styles.itemMeta}>
        <span className={styles.badge}>{t(`report.reason.${report.reason}`)}</span>
        <span className={styles.itemType}>{report.target_type}</span>
        <span className={styles.itemTime}>{new Date(report.created_at).toLocaleString('ko-KR')}</span>
      </div>
      {preview ? <p className={styles.preview}>{preview.body}</p> : null}
      {report.detail ? <p className={styles.detail}>{t('admin.reportDetail', { detail: report.detail })}</p> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.dangerBtn} disabled={busy} onClick={handleRemove}>
          {t('action.delete', { ns: 'common' })}
        </button>
        <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={handleDismiss}>
          {t('admin.dismiss')}
        </button>
      </div>
    </div>
  );
}

interface PendingItem {
  kind: 'post' | 'companion_post';
  id: string;
  preview: string;
  created_at: string;
}

function PendingPostRow({ item, onResolved }: { item: PendingItem; onResolved: () => void }) {
  const { t } = useTranslation(['community', 'common']);
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    try {
      if (item.kind === 'post') await setPostStatus(item.id, 'published');
      else await setCompanionPostStatus(item.id, 'recruiting');
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      if (item.kind === 'post') await setPostStatus(item.id, 'removed');
      else await setCompanionPostStatus(item.id, 'removed');
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.item}>
      <div className={styles.itemMeta}>
        {item.kind === 'companion_post' ? <span className={styles.itemType}>{t('admin.tabs.companion')}</span> : null}
        <span className={styles.itemTime}>{new Date(item.created_at).toLocaleString('ko-KR')}</span>
      </div>
      <p className={styles.preview}>{item.preview}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} disabled={busy} onClick={handleApprove}>
          {t('admin.approve')}
        </button>
        <button type="button" className={styles.dangerBtn} disabled={busy} onClick={handleRemove}>
          {t('action.delete', { ns: 'common' })}
        </button>
      </div>
    </div>
  );
}

/**
 * 운영 콘솔 (06-community.md §9) — 신고 큐 + 자동 플래그 큐 최소 기능.
 * 접근 제어: profiles.role='admin' (§9). AppShell 하단 탭 밖의 독립 라우트.
 */
export function AdminScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { user, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('reports');

  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ['admin', 'is-admin', user?.id ?? ''],
    queryFn: () => isAdmin(user!.id),
    enabled: !!user,
  });

  const reportsQuery = useQuery({ queryKey: ['admin', 'reports'], queryFn: listOpenReports, enabled: !!admin });
  const pendingQuery = useQuery({
    queryKey: ['admin', 'pending'],
    queryFn: async (): Promise<PendingItem[]> => {
      const [posts, companionPosts] = await Promise.all([listPendingReviewPosts(), listPendingReviewCompanionPosts()]);
      const postItems: PendingItem[] = posts.map((p) => ({ kind: 'post', id: p.id, preview: p.body, created_at: p.created_at }));
      const companionItems: PendingItem[] = companionPosts.map((p) => ({
        kind: 'companion_post',
        id: p.id,
        preview: `${p.title}\n${p.body}`,
        created_at: p.created_at,
      }));
      return [...postItems, ...companionItems].sort((a, b) => a.created_at.localeCompare(b.created_at));
    },
    enabled: !!admin,
  });

  useEffect(() => {
    trackScreenView('community_admin');
  }, []);

  function refetchAll() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'pending'] });
  }

  if (sessionLoading || adminLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="80px" />
      </div>
    );
  }
  if (!user || !admin) {
    return <EmptyState icon={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><LockIcon size={16} /></span>} message={t('admin.accessDenied')} />;
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>{t('admin.title')}</h1>
      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === 'reports' ? styles.tabActive : styles.tab}
          onClick={() => setTab('reports')}
        >
          {t('admin.tabs.reports')} {reportsQuery.data ? `(${reportsQuery.data.length})` : ''}
        </button>
        <button
          type="button"
          className={tab === 'pending' ? styles.tabActive : styles.tab}
          onClick={() => setTab('pending')}
        >
          {t('admin.tabs.pending')} {pendingQuery.data ? `(${pendingQuery.data.length})` : ''}
        </button>
        <button
          type="button"
          className={tab === 'users' ? styles.tabActive : styles.tab}
          onClick={() => setTab('users')}
        >
          {t('admin.tabs.users')}
        </button>
        <button
          type="button"
          className={tab === 'feedback' ? styles.tabActive : styles.tab}
          onClick={() => setTab('feedback')}
        >
          {t('admin.tabs.feedback')}
        </button>
        <button
          type="button"
          className={tab === 'sales' ? styles.tabActive : styles.tab}
          onClick={() => setTab('sales')}
        >
          {t('admin.tabs.sales')}
        </button>
      </div>

      {tab === 'sales' ? (
        <AdminSalesTab />
      ) : tab === 'users' ? (
        <UserPlanTab />
      ) : tab === 'feedback' ? (
        <FeedbackTab />
      ) : tab === 'reports' ? (
        reportsQuery.isLoading ? (
          <Skeleton height="80px" />
        ) : !reportsQuery.data || reportsQuery.data.length === 0 ? (
          <EmptyState icon={<CheckCircle size={48} />} message={t('admin.noReports')} />
        ) : (
          <div className={styles.list}>
            {reportsQuery.data.map((r) => (
              <ReportRow key={r.id} report={r} onResolved={refetchAll} />
            ))}
          </div>
        )
      ) : pendingQuery.isLoading ? (
        <Skeleton height="80px" />
      ) : !pendingQuery.data || pendingQuery.data.length === 0 ? (
        <EmptyState icon={<CheckCircle size={48} />} message={t('admin.noPending')} />
      ) : (
        <div className={styles.list}>
          {pendingQuery.data.map((p) => (
            <PendingPostRow key={`${p.kind}-${p.id}`} item={p} onResolved={refetchAll} />
          ))}
        </div>
      )}
    </div>
  );
}
