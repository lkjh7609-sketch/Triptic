import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { captureError } from '@/shared/monitoring';
import { adminLiftSuspension, adminListSuspensions, type AdminSuspension } from './adminService';
import styles from './AdminScreen.module.css';
import memberStyles from './AdminMembersTab.module.css';

/** 강제 탈퇴로 이용 정지된 이메일 목록 — 여기서 정지를 해제하면 그 이메일로 다시 가입·로그인할 수 있다 */
export function AdminSuspensionsSection() {
  const { t, i18n } = useTranslation(['community', 'common']);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [lifting, setLifting] = useState<AdminSuspension | null>(null);
  const list = useQuery({ queryKey: ['admin', 'suspensions'], queryFn: adminListSuspensions });
  const active = (list.data ?? []).filter((s) => !s.lifted_at).length;
  const dt = (iso: string) => new Date(iso).toLocaleString(i18n.language);

  async function lift(item: AdminSuspension) {
    try {
      await adminLiftSuspension(item.id);
      showToast(t('admin.members.suspended.liftDone', { ns: 'community' }), { tone: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'suspensions'] });
    } catch (err) {
      captureError(err, { context: 'adminLiftSuspension' });
      showToast(t('admin.members.suspended.liftFailed', { ns: 'community' }), { tone: 'error' });
    }
  }

  return (
    <section className={memberStyles.suspended} aria-label={t('admin.members.suspended.title', { ns: 'community' })}>
      <button type="button" className={memberStyles.suspendedHead} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span>
          {t('admin.members.suspended.title', { ns: 'community' })} ({active})
        </span>
        <ChevronDown size={18} aria-hidden="true" className={open ? memberStyles.chevOpen : memberStyles.chev} />
      </button>
      {open ? (
        list.isError ? (
          <p className={memberStyles.muted} role="alert">
            {t('admin.members.suspended.loadFailed', { ns: 'community' })}
          </p>
        ) : (list.data ?? []).length === 0 ? (
          <p className={memberStyles.muted}>{t('admin.members.suspended.empty', { ns: 'community' })}</p>
        ) : (
          <ul className={memberStyles.suspendedList}>
            {(list.data ?? []).map((s) => (
              <li key={s.id} className={`${memberStyles.suspendedItem} ${s.lifted_at ? memberStyles.suspendedLifted : ''}`}>
                <span className={memberStyles.suspendedInfo}>
                  <strong>{s.email}</strong>
                  <span className={memberStyles.muted}>
                    {[s.display_name, t(`suspension.reasons.${s.reason}`, { ns: 'common' })].filter(Boolean).join(' · ')}
                  </span>
                  <span className={memberStyles.muted}>
                    {s.lifted_at ? t('admin.members.suspended.liftedAt', { ns: 'community', time: dt(s.lifted_at) }) : t('admin.members.suspended.at', { ns: 'community', time: dt(s.suspended_at) })}
                  </span>
                </span>
                {s.lifted_at ? null : (
                  <button type="button" className={styles.secondaryBtn} onClick={() => setLifting(s)}>
                    {t('admin.members.suspended.lift', { ns: 'community' })}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )
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
