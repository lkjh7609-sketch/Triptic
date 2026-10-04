import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { captureError } from '@/shared/monitoring';
import { showToast } from '@/shared/ui/toast';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { announcementsQueryKey } from '@/features/notices/useAnnouncements';
import {
  adminListAnnouncements,
  deleteAnnouncement,
  saveAnnouncement,
  type Announcement,
  type AnnouncementInput,
} from '@/features/notices/noticeService';
import styles from './AdminScreen.module.css';
import noticeStyles from './AdminNoticesTab.module.css';

const EMPTY: AnnouncementInput = { kind: 'notice', title: '', body: '', version: '', pinned: false, published: true };

/** 운영 콘솔 '공지' 탭 — 공지사항·앱 업데이트 내역을 쓰고 고치고 지운다(공개하면 /notices와 종 알림에 뜬다) */
export function AdminNoticesTab() {
  const { t } = useTranslation('community');
  const { user } = useSession();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['admin', 'announcements'], queryFn: adminListAnnouncements });
  const [form, setForm] = useState<AnnouncementInput>(EMPTY);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    void queryClient.invalidateQueries({ queryKey: announcementsQueryKey });
  }

  const save = useMutation({
    mutationFn: () => saveAnnouncement(form, user!.id),
    onSuccess: () => {
      showToast(t('admin.notices.saved'), { tone: 'success' });
      setForm(EMPTY);
      refresh();
    },
    onError: (err) => {
      captureError(err, { context: 'saveAnnouncement' });
      showToast(t('admin.notices.saveFailed'), { tone: 'error' });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: refresh,
  });

  function startEdit(a: Announcement) {
    setForm({ id: a.id, kind: a.kind, title: a.title, body: a.body, version: a.version ?? '', pinned: a.pinned, published: a.published });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const canSave = form.title.trim().length > 0 && form.body.trim().length > 0 && !save.isPending;

  return (
    <div className={noticeStyles.wrap}>
      <section className={noticeStyles.form} aria-label={t('admin.notices.title')}>
        <h2 className={noticeStyles.heading}>{form.id ? t('admin.notices.editing') : t('admin.notices.title')}</h2>
        <div className={noticeStyles.row}>
          <label className={noticeStyles.field}>
            <span>{t('admin.notices.kind')}</span>
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as AnnouncementInput['kind'] })}>
              <option value="notice">{t('admin.notices.kindNotice')}</option>
              <option value="update">{t('admin.notices.kindUpdate')}</option>
            </select>
          </label>
          <label className={noticeStyles.field}>
            <span>{t('admin.notices.versionLabel')}</span>
            <input value={form.version} maxLength={20} placeholder="3.1.0" onChange={(e) => setForm({ ...form, version: e.target.value })} />
          </label>
        </div>
        <label className={noticeStyles.field}>
          <span>{t('admin.notices.titleLabel')}</span>
          <input value={form.title} maxLength={100} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label className={noticeStyles.field}>
          <span>{t('admin.notices.bodyLabel')}</span>
          <textarea value={form.body} rows={8} maxLength={5000} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        </label>
        <div className={noticeStyles.checks}>
          <label>
            <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> {t('admin.notices.pinned')}
          </label>
          <label>
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> {t('admin.notices.published')}
          </label>
        </div>
        <div className={noticeStyles.actions}>
          {form.id ? (
            <button type="button" className={noticeStyles.secondary} onClick={() => setForm(EMPTY)}>
              {t('admin.notices.cancelEdit')}
            </button>
          ) : null}
          <button type="button" className={noticeStyles.primary} disabled={!canSave} onClick={() => save.mutate()}>
            {form.id ? t('admin.notices.save') : t('admin.notices.saveNew')}
          </button>
        </div>
      </section>

      {list.isLoading ? (
        <Skeleton height="80px" />
      ) : (list.data ?? []).length === 0 ? (
        <p className={noticeStyles.empty}>{t('admin.notices.empty')}</p>
      ) : (
        <div className={styles.list}>
          {(list.data ?? []).map((a) => (
            <article key={a.id} className={noticeStyles.item}>
              <div className={noticeStyles.itemMain}>
                <span className={noticeStyles.itemMeta}>
                  {t(`admin.notices.${a.kind === 'update' ? 'kindUpdate' : 'kindNotice'}`)}
                  {a.version ? ` · v${a.version}` : ''}
                  {a.pinned ? ` · ${t('notices.pinned')}` : ''}
                  {!a.published ? ` · ${t('admin.notices.draft')}` : ''}
                  {` · ${a.published_at.slice(0, 10)}`}
                </span>
                <strong>{a.title}</strong>
              </div>
              <div className={noticeStyles.itemActions}>
                <button type="button" className={noticeStyles.iconBtn} onClick={() => startEdit(a)} aria-label={t('admin.notices.edit')}>
                  <Pencil size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={noticeStyles.iconBtn}
                  onClick={() => {
                    if (window.confirm(t('admin.notices.deleteConfirm'))) remove.mutate(a.id);
                  }}
                  aria-label={t('admin.notices.delete')}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
