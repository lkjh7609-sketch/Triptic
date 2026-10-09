import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Lock as LockIcon } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { isAdmin } from './communityService';
import {
  ADMIN_DASHBOARD_KEY,
  adminDashboardStats,
  adminListFeedback,
  adminMarkFeedbackReviewed,
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
  type AdminFeedbackFilter,
  type AdminFeedbackRow,
} from './adminService';
import type { Report } from './types';
import { AdminSalesTab } from './AdminSalesTab';
import { AdminAnalyticsTab } from './AdminAnalyticsTab';
import { AdminPinPad } from './AdminPinPad';
import { AdminArchiveTab } from './AdminArchiveTab';
import { AdminNoticesTab } from './AdminNoticesTab';
import { AdminMembersTab } from './AdminMembersTab';
import { AdminShell } from './AdminShell';
import { AdminDashboard } from './AdminDashboard';
import { AdminSuspensionHistory } from './AdminSuspensionHistory';
import { AdminPillRow } from './AdminFilters';
import { parseSection, type AdminSection } from './adminSections';
import { useSectionLabel } from './useSectionLabel';
import styles from './AdminScreen.module.css';

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
        {item.category === 'partnership' ? <span className={styles.badge}>{t('admin.feedbackCategoryPartnership')}</span> : null}
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
  const [filter, setFilter] = useState<AdminFeedbackFilter>('all');
  const feedbackQuery = useQuery({
    queryKey: ['admin', 'feedback', filter, page],
    queryFn: () => adminListFeedback(page, FEEDBACK_PAGE_SIZE, filter),
  });
  const [overrides, setOverrides] = useState<Record<string, AdminFeedbackRow>>({});

  const displayedRows = (feedbackQuery.data?.rows ?? []).map((r) => overrides[r.id] ?? r);

  // 일반 문의 / 제휴문의를 나눠 본다(0071)
  const filters = (
    <AdminPillRow
      label={t('admin.feedbackFilterLabel')}
      value={filter}
      options={(['all', 'general', 'partnership'] as const).map((key) => ({ value: key, label: t(`admin.feedbackFilter.${key}`) }))}
      onChange={(key) => {
        setFilter(key as AdminFeedbackFilter);
        setPage(0);
      }}
    />
  );

  if (feedbackQuery.isLoading) {
    return (
      <>
        {filters}
        <Skeleton height="60px" />
      </>
    );
  }
  if (displayedRows.length === 0) {
    return (
      <>
        {filters}
        <EmptyState message={t('admin.feedbackEmpty')} />
      </>
    );
  }
  return (
    <>
      {filters}
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
  const [params, setParams] = useSearchParams();
  // 어느 메뉴인지는 주소(?tab=)에 둔다 — 새로고침·뒤로가기에도 그대로
  const section = parseSection(params.get('tab'));
  const labelOf = useSectionLabel();
  const select = (next: AdminSection) => setParams(next === 'dashboard' ? {} : { tab: next });

  const { data: admin, isLoading: adminLoading } = useQuery({
    queryKey: ['admin', 'is-admin', user?.id ?? ''],
    queryFn: () => isAdmin(user!.id),
    enabled: !!user,
  });

  // 메뉴 옆 배지(건의·정지 중)와 대시보드가 같이 쓰는 숫자 — 아직 0109가 없어도 나머지 화면은 그대로 동작한다
  const dashboardQuery = useQuery({ queryKey: ADMIN_DASHBOARD_KEY, queryFn: adminDashboardStats, enabled: !!admin, staleTime: 30_000, retry: false });
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
    queryClient.invalidateQueries({ queryKey: ADMIN_DASHBOARD_KEY });
  }

  if (sessionLoading || adminLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="80px" />
      </div>
    );
  }
  // 로그인하지 않은 방문자에게는 6자리 비밀번호 키패드 — 맞으면 관리자 로그인 상태가 된다(adminPinService).
  // 로그인한 일반 사용자는 세션을 바꾸지 않도록 키패드 대신 권한 안내만 보인다
  if (!user) return <AdminPinPad />;
  if (!admin) {
    return <EmptyState icon={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><LockIcon size={16} /></span>} message={t('admin.accessDenied')} />;
  }

  return (
    <AdminShell
      active={section}
      onSelect={select}
      badges={{
        reports: reportsQuery.data?.length,
        pending: pendingQuery.data?.length,
        feedback: dashboardQuery.data?.feedback_new,
      }}
    >
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>{labelOf(section)}</h1>
        {section === 'dashboard' ? (
          <AdminDashboard onNavigate={select} />
        ) : section === 'notices' ? (
          <AdminNoticesTab />
        ) : section === 'archive' ? (
          <AdminArchiveTab />
        ) : section === 'analytics' ? (
          <AdminAnalyticsTab />
        ) : section === 'sales' ? (
          <AdminSalesTab />
        ) : section === 'members' ? (
          <AdminMembersTab onOpenHistory={() => select('suspensions')} />
        ) : section === 'suspensions' ? (
          <AdminSuspensionHistory />
        ) : section === 'feedback' ? (
          <FeedbackTab />
        ) : section === 'reports' ? (
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
    </AdminShell>
  );
}
