import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import confirmStyles from '@/shared/ui/ConfirmDialog.module.css';
import { SUSPENSION_REASONS, type SuspensionReason } from '@/shared/suspension';
import styles from './AdminMembersTab.module.css';

interface RemoveMemberDialogProps {
  name: string;
  onConfirm: (reason: SuspensionReason) => void;
  onClose: () => void;
}

/** 강제 탈퇴 확인 — 정지 사유를 드롭다운으로 골라야 누를 수 있다(그 이메일은 이용 정지 명단에 올라 다시 가입·로그인하지 못한다) */
export function RemoveMemberDialog({ name, onConfirm, onClose }: RemoveMemberDialogProps) {
  const { t } = useTranslation(['community', 'common']);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [reason, setReason] = useState<SuspensionReason | ''>('');
  const title = t('admin.members.remove.title', { ns: 'community', name });

  return (
    <div className={modalStyles.overlay}>
      <div ref={focusTrapRef} className={modalStyles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={modalStyles.title}>{title}</h2>
        <p className={confirmStyles.message}>{t('admin.members.remove.message', { ns: 'community' })}</p>
        <label className={styles.reasonField}>
          <span>{t('admin.members.remove.reasonLabel', { ns: 'community' })}</span>
          <select value={reason} onChange={(e) => setReason(e.target.value as SuspensionReason | '')}>
            <option value="">{t('admin.members.remove.reasonPlaceholder', { ns: 'community' })}</option>
            {SUSPENSION_REASONS.map((r) => (
              <option key={r} value={r}>
                {t(`suspension.reasons.${r}`, { ns: 'common' })}
              </option>
            ))}
          </select>
        </label>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('admin.members.remove.cancel', { ns: 'community' })}
          </button>
          <button
            type="button"
            className={`${modalStyles.primary} ${confirmStyles.dangerBtn}`}
            disabled={!reason}
            onClick={() => {
              if (!reason) return;
              onClose();
              onConfirm(reason);
            }}
          >
            {t('admin.members.remove.confirm', { ns: 'community' })}
          </button>
        </div>
      </div>
    </div>
  );
}
