import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { isAdmin } from './communityService';
import {
  getReportTargetPreview,
  listOpenReports,
  listPendingReviewPosts,
  resolveReport,
  setCommentStatus,
  setPostStatus,
} from './adminService';
import { REPORT_REASON_LABELS, type Report } from './types';
import styles from './AdminScreen.module.css';

type Tab = 'reports' | 'pending';

function ReportRow({ report, onResolved }: { report: Report; onResolved: () => void }) {
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
        <span className={styles.badge}>{REPORT_REASON_LABELS[report.reason]}</span>
        <span className={styles.itemType}>{report.target_type}</span>
        <span className={styles.itemTime}>{new Date(report.created_at).toLocaleString('ko-KR')}</span>
      </div>
      {preview ? <p className={styles.preview}>{preview.body}</p> : null}
      {report.detail ? <p className={styles.detail}>신고 상세: {report.detail}</p> : null}
      <div className={styles.actions}>
        <button type="button" className={styles.dangerBtn} disabled={busy} onClick={handleRemove}>
          삭제
        </button>
        <button type="button" className={styles.secondaryBtn} disabled={busy} onClick={handleDismiss}>
          기각
        </button>
      </div>
    </div>
  );
}

function PendingPostRow({ post, onResolved }: { post: { id: string; body: string; created_at: string }; onResolved: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleApprove() {
    setBusy(true);
    try {
      await setPostStatus(post.id, 'published');
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await setPostStatus(post.id, 'removed');
      onResolved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.item}>
      <div className={styles.itemMeta}>
        <span className={styles.itemTime}>{new Date(post.created_at).toLocaleString('ko-KR')}</span>
      </div>
      <p className={styles.preview}>{post.body}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primaryBtn} disabled={busy} onClick={handleApprove}>
          승인
        </button>
        <button type="button" className={styles.dangerBtn} disabled={busy} onClick={handleRemove}>
          삭제
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
    queryFn: listPendingReviewPosts,
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
    return <EmptyState icon="🔒" message="운영자 권한이 필요한 화면이에요." />;
  }

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>운영 콘솔</h1>
      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === 'reports' ? styles.tabActive : styles.tab}
          onClick={() => setTab('reports')}
        >
          신고 큐 {reportsQuery.data ? `(${reportsQuery.data.length})` : ''}
        </button>
        <button
          type="button"
          className={tab === 'pending' ? styles.tabActive : styles.tab}
          onClick={() => setTab('pending')}
        >
          자동 플래그 큐 {pendingQuery.data ? `(${pendingQuery.data.length})` : ''}
        </button>
      </div>

      {tab === 'reports' ? (
        reportsQuery.isLoading ? (
          <Skeleton height="80px" />
        ) : !reportsQuery.data || reportsQuery.data.length === 0 ? (
          <EmptyState icon="✅" message="처리할 신고가 없어요." />
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
        <EmptyState icon="✅" message="검토 대기 중인 글이 없어요." />
      ) : (
        <div className={styles.list}>
          {pendingQuery.data.map((p) => (
            <PendingPostRow key={p.id} post={p} onResolved={refetchAll} />
          ))}
        </div>
      )}
    </div>
  );
}
