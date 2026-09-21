import { useState } from 'react';
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
  const { user } = useSession();
  const blockMutation = useBlockUser(user?.id ?? null);
  const [open, setOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const isOwn = !!user && user.id === authorId;

  function handleBlock() {
    setOpen(false);
    if (window.confirm('이 사용자를 차단할까요? 차단하면 서로의 글·댓글이 보이지 않아요.')) {
      blockMutation.mutate(authorId);
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.trigger} onClick={() => setOpen((v) => !v)} aria-label="더보기">
        ⋮
      </button>
      {open ? (
        <div className={styles.dropdown} onMouseLeave={() => setOpen(false)}>
          {isOwn ? (
            onDelete ? (
              <button
                type="button"
                className={styles.danger}
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                삭제
              </button>
            ) : null
          ) : (
            <>
              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  setOpen(false);
                  setShowReport(true);
                }}
              >
                신고
              </button>
              <button type="button" className={styles.danger} onClick={handleBlock}>
                사용자 차단
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
