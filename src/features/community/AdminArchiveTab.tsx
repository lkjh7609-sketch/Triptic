import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { adminGetArchived, adminListArchived, type ArchivedItem } from './adminService';
import styles from './AdminScreen.module.css';

const PAGE_SIZE = 20;

function ArchivedRow({ item }: { item: ArchivedItem }) {
  const { t, i18n } = useTranslation('community');
  const [open, setOpen] = useState(false);
  const detail = useQuery({ queryKey: ['admin', 'archived', item.id], queryFn: () => adminGetArchived(item.id), enabled: open, staleTime: 60_000 });
  const date = new Date(item.archived_at).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const kind = item.source_table === 'posts' ? t('admin.archive.kindPost') : t('admin.archive.kindCompanion');
  const comments = detail.data?.children.comments ?? [];
  const full = detail.data ? String(detail.data.snapshot.body ?? '') : '';

  return (
    <div className={styles.item}>
      <div className={styles.userRow}>
        <div className={styles.userInfo}>
          <span className={styles.userHandle}>
            {kind} · @{item.author_handle || t('admin.userNoHandle')} {item.author_name ? `(${item.author_name})` : ''}
          </span>
          <span className={styles.userName}>{t(`admin.archive.reason.${item.reason}`, { defaultValue: item.reason })} · {date}</span>
          <span className={styles.preview}>{item.preview || t('admin.archive.noText')}</span>
          {item.comment_count > 0 ? <span className={styles.tripUsage}>{t('admin.archive.comments', { count: item.comment_count })}</span> : null}
        </div>
        <button type="button" className={styles.secondaryBtn} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? t('admin.archive.close') : t('admin.archive.view')}
        </button>
      </div>
      {open ? (
        <div className={styles.limitBox}>
          {detail.isLoading ? (
            <Skeleton height="60px" />
          ) : detail.isError || !detail.data ? (
            <span className={styles.limitPreview}>{t('admin.archive.loadError')}</span>
          ) : (
            <div style={{ display: 'grid', gap: 8, flexBasis: '100%' }}>
              {detail.data.snapshot.title ? <strong>{String(detail.data.snapshot.title)}</strong> : null}
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{full}</p>
              {comments.map((c, i) => (
                <p key={i} className={styles.limitPreview} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  ↳ {c.body}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** 운영 콘솔 "보관함" — 사용자가 삭제한 글·취소한 모집(0067). 읽기 전용. 작성자가 탈퇴하면 함께 사라진다 */
export function AdminArchiveTab() {
  const { t } = useTranslation('community');
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ['admin', 'archive', page], queryFn: () => adminListArchived(page, PAGE_SIZE), retry: false });

  if (query.isLoading) return <Skeleton height="80px" />;
  if (query.isError || !query.data) return <ErrorState summary={t('admin.archive.loadError')} onRetry={() => query.refetch()} />;
  if (query.data.rows.length === 0 && page === 0) return <EmptyState message={t('admin.archive.empty')} />;

  return (
    <div>
      <p className={styles.limitPreview}>{t('admin.archive.note')}</p>
      <div className={styles.list}>
        {query.data.rows.map((item) => (
          <ArchivedRow key={item.id} item={item} />
        ))}
      </div>
      <div className={styles.pagerRow}>
        <button type="button" className={styles.secondaryBtn} disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
          {t('admin.prevPage')}
        </button>
        <span className={styles.pagerLabel}>{t('admin.pageLabel', { page: page + 1 })}</span>
        <button type="button" className={styles.secondaryBtn} disabled={!query.data.hasMore} onClick={() => setPage((p) => p + 1)}>
          {t('admin.nextPage')}
        </button>
      </div>
    </div>
  );
}
