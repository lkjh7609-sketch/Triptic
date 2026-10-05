import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { captureError } from '@/shared/monitoring';
import { adminDeleteArchived, adminGetArchived, adminListArchived, type ArchivedItem } from './adminService';
import { getPostImageUrl } from './imageProcessing';
import styles from './AdminScreen.module.css';

const PAGE_SIZE = 20;

function ArchivedRow({ item, selected, onToggle }: { item: ArchivedItem; selected: boolean; onToggle: () => void }) {
  const { t, i18n } = useTranslation('community');
  const [open, setOpen] = useState(false);
  const detail = useQuery({ queryKey: ['admin', 'archived', item.id], queryFn: () => adminGetArchived(item.id), enabled: open, staleTime: 60_000 });
  const date = new Date(item.archived_at).toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  const kind = item.source_table === 'posts' ? t('admin.archive.kindPost') : t('admin.archive.kindCompanion');
  const comments = detail.data?.children.comments ?? [];
  const images = [...(detail.data?.children.post_images ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const full = detail.data ? String(detail.data.snapshot.body ?? '') : '';

  return (
    <div className={styles.item}>
      <div className={styles.userRow}>
        <input type="checkbox" checked={selected} onChange={onToggle} aria-label={t('admin.archive.select')} style={{ width: 20, height: 20, marginRight: 8, flexShrink: 0 }} />
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
              {images.length > 0 ? (
                <div className={styles.archivePhotos}>
                  {images.map((img, i) => (
                    <a key={img.storage_path} href={getPostImageUrl(img.storage_path)} target="_blank" rel="noreferrer" className={styles.archivePhoto}>
                      <img src={getPostImageUrl(img.storage_path)} alt={t('admin.archive.photoAlt', { n: i + 1 })} loading="lazy" />
                    </a>
                  ))}
                </div>
              ) : null}
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
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirm, setConfirm] = useState<'selected' | 'all' | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'archive', page], queryFn: () => adminListArchived(page, PAGE_SIZE), retry: false });

  async function runDelete(ids: number[] | null) {
    try {
      const count = await adminDeleteArchived(ids);
      showToast(t('admin.archive.deleted', { count }), { tone: 'success' });
      setSelected(new Set());
      setPage(0);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'archive'] });
    } catch (err) {
      captureError(err, { context: 'adminDeleteArchived' });
      showToast(t('admin.archive.deleteFailed'), { tone: 'error' });
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (query.isLoading) return <Skeleton height="80px" />;
  if (query.isError || !query.data) return <ErrorState summary={t('admin.archive.loadError')} onRetry={() => query.refetch()} />;
  if (query.data.rows.length === 0 && page === 0) return <EmptyState message={t('admin.archive.empty')} />;

  const pageIds = query.data.rows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  return (
    <div>
      <p className={styles.limitPreview}>{t('admin.archive.note')}</p>
      <div className={styles.pagerRow} style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={allPageSelected}
            onChange={() => setSelected(allPageSelected ? new Set() : new Set(pageIds))}
          />
          {t('admin.archive.selectAll')}
        </label>
        <span style={{ display: 'inline-flex', gap: 8 }}>
          <button type="button" className={styles.secondaryBtn} disabled={selected.size === 0} onClick={() => setConfirm('selected')}>
            {t('admin.archive.deleteSelected', { count: selected.size })}
          </button>
          <button type="button" className={styles.primaryBtn} style={{ background: 'var(--danger)' }} onClick={() => setConfirm('all')}>
            {t('admin.archive.emptyAll')}
          </button>
        </span>
      </div>
      <div className={styles.list}>
        {query.data.rows.map((item) => (
          <ArchivedRow key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggle(item.id)} />
        ))}
      </div>
      {confirm ? (
        <ConfirmDialog
          danger
          title={confirm === 'all' ? t('admin.archive.emptyAll') : t('admin.archive.deleteSelected', { count: selected.size })}
          message={confirm === 'all' ? t('admin.archive.confirmAll') : t('admin.archive.confirmSelected', { count: selected.size })}
          cancelLabel={t('admin.members.remove.cancel')}
          confirmLabel={t('action.delete', { ns: 'common' })}
          onConfirm={() => void runDelete(confirm === 'all' ? null : Array.from(selected))}
          onClose={() => setConfirm(null)}
        />
      ) : null}
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
