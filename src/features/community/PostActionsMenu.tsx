import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useBlockUser } from './hooks/useCommunitySafety';
import { ReportModal } from './ReportModal';
import type { ReportTargetType } from './types';
import styles from './PostActionsMenu.module.css';

interface PostActionsMenuProps {
  targetType: ReportTargetType;
  targetId: string;
  authorId: string;
  onDelete?: () => void;
}

/** 글/댓글 공용 ⋮ 메뉴 — 신고 / (타인) 차단 / (본인) 삭제 (06-community.md §1, §5.2, §5.3) */
export function PostActionsMenu({ targetType, targetId, authorId, onDelete }: PostActionsMenuProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const blockMutation = useBlockUser(user?.id ?? null);
  const [open, setOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const isOwn = !!user && user.id === authorId;

  function handleBlock() {
    setOpen(false);
    if (window.confirm(t('menu.blockConfirm'))) {
      blockMutation.mutate(authorId);
    }
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('menu.ariaLabel')}
      >
        ⋮
      </button>
      {open ? (
        <div className={styles.dropdown} onMouseLeave={() => setOpen(false)} role="menu">
          {isOwn ? (
            onDelete ? (
              <button
                type="button"
                role="menuitem"
                className={styles.danger}
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                {t('action.delete', { ns: 'common' })}
              </button>
            ) : null
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                className={styles.item}
                onClick={() => {
                  setOpen(false);
                  setShowReport(true);
                }}
              >
                {t('menu.report')}
              </button>
              <button type="button" role="menuitem" className={styles.danger} onClick={handleBlock}>
                {t('menu.blockUser')}
              </button>
            </>
          )}
        </div>
      ) : null}
      {showReport ? (
        <ReportModal targetType={targetType} targetId={targetId} onClose={() => setShowReport(false)} />
      ) : null}
    </div>
  );
}
