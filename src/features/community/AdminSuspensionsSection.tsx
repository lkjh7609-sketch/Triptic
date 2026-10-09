import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, History } from 'lucide-react';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { captureError } from '@/shared/monitoring';
import { adminLiftSuspension, adminListSuspensions, type AdminSuspension } from './adminService';
import styles from './AdminScreen.module.css';
import memberStyles from './AdminMembersTab.module.css';

const KEY = ['admin', 'suspensions'] as const;

/**
 * 지금 이용 정지 중인 이메일 목록 — 여기서 정지를 해제하면 그 이메일로 다시 가입·로그인할 수 있고, 해제한 줄은 이 목록에서 바로 사라진다.
 * 해제한 기록까지 포함한 전체 내역(영구 보관)은 '정지 기록' 화면에서 검색·필터로 본다.
 */
export function AdminSuspensionsSection({ onOpenHistory }: { onOpenHistory?: () => void }) {
  const { t, i18n } = useTranslation(['community', 'common']);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lifting, setLifting] = useState<AdminSuspension | null>(null);
  const list = useQuery({ queryKey: KEY, queryFn: adminListSuspensions });
  const active = (list.data ?? []).filter((s) => !s.lifted_at);
  const dt = (iso: string) => new Date(iso).toLocaleString(i18n.language);

  async function lift(item: AdminSuspension) {
    // 서버 응답을 기다리지 않고 바로 목록에서 뺀다 — 실패하면 되돌린다
    const before = queryClient.getQueryData<AdminSuspension[]>(KEY);
    queryClient.setQueryData<AdminSuspension[]>(KEY, (old) => old?.map((s) => (s.id === item.id ? { ...s, lifted_at: new Date().toISOString() } : s)));
    try {
      await adminLiftSuspension(item.id);
      showToast(t('admin.members.suspended.liftDone', { ns: 'community' }), { tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'suspension-history'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    } catch (err) {
      queryClient.setQueryData(KEY, before);
      captureError(err, { context: 'adminLiftSuspension' });
      showToast(t('admin.members.suspended.liftFailed', { ns: 'community' }), { tone: 'error' });
    }
  }

  return (
    <section className={memberStyles.suspended} aria-label={t('admin.members.suspended.title', { ns: 'community' })}>
      <button type="button" className={memberStyles.suspendedHead} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>
          {t('admin.members.suspended.title', { ns: 'community' })} ({active.length})
        </span>
        <ChevronDown size={18} aria-hidden="true" className={open ? memberStyles.chevOpen : memberStyles.chev} />
      </button>
      {open ? (
        <>
          {list.isError ? (
            <p className={memberStyles.muted} role="alert">
              {t('admin.members.suspended.loadFailed', { ns: 'community' })}
            </p>
          ) : active.length === 0 ? (
            <p className={memberStyles.muted}>{t('admin.members.suspended.empty', { ns: 'community' })}</p>
          ) : (
            <ul className={memberStyles.suspendedList}>
              {active.map((s) => (
                <li key={s.id} className={memberStyles.suspendedItem}>
                  <span className={memberStyles.suspendedInfo}>
                    <strong>{s.email}</strong>
                    <span className={memberStyles.muted}>
                      {[s.display_name, s.reason === 'custom' && s.reason_text ? s.reason_text : t(`suspension.reasons.${s.reason}`, { ns: 'common' })].filter(Boolean).join(' · ')}
                    </span>
                    <span className={memberStyles.muted}>{t('admin.members.suspended.at', { ns: 'community', time: dt(s.suspended_at) })}</span>
                  </span>
                  <button type="button" className={styles.secondaryBtn} onClick={() => setLifting(s)}>
                    {t('admin.members.suspended.lift', { ns: 'community' })}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {onOpenHistory ? (
            <button type="button" className={memberStyles.historyLink} onClick={onOpenHistory}>
              <History size={14} aria-hidden="true" /> {t('admin.members.suspended.openHistory', { ns: 'community' })}
            </button>
          ) : null}
        </>
      ) : null}
      {lifting ? (
        <ConfirmDialog
          title={t('admin.members.suspended.liftTitle', { ns: 'community', email: lifting.email })}
          message={t('admin.members.suspended.liftMessage', { ns: 'community' })}
          cancelLabel={t('admin.members.suspended.liftCancel', { ns: 'community' })}
          confirmLabel={t('admin.members.suspended.liftConfirm', { ns: 'community' })}
          onConfirm={() => void lift(lifting)}
          onClose={() => setLifting(null)}
        />
      ) : null}
    </section>
  );
}
