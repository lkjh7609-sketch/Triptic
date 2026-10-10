import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EllipsisVertical, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useSession } from '@/shared/hooks/useSession';
import { useBlockUser } from './hooks/useCommunitySafety';
import { ReportModal } from './ReportModal';
import type { ReportTargetType } from './types';
import styles from './PostActionsMenu.module.css';

interface PostActionsMenuProps {
  targetType: ReportTargetType;
  targetId: string;
  authorId: string;
  /** 수정은 본인 글에서만 쓴다 — 없으면 해당 항목을 감춘다. 삭제는 본인 글이거나 관리자일 때만 넘긴다 */
  onEdit?: () => void;
  onDelete?: () => void;
  /** 관리자 전용 '도시 공식 가이드로 고정/해제' — 넘길 때만 보인다(권한은 서버 함수가 다시 확인한다) */
  onTogglePin?: () => void;
  pinned?: boolean;
  onReported?: () => void;
}

/** 글/댓글 공용 ⋮ 메뉴 — (본인) 수정·삭제, (관리자) 공식 가이드 고정, (타인) 신고·차단 (06-community.md §1, §5.2, §5.3) */
export function PostActionsMenu({
  targetType,
  targetId,
  authorId,
  onEdit,
  onDelete,
  onTogglePin,
  pinned = false,
  onReported,
}: PostActionsMenuProps) {
  const { t } = useTranslation(['community', 'common']);
  const { user } = useSession();
  const blockMutation = useBlockUser(user?.id ?? null);
  const [open, setOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isOwn = !!user && user.id === authorId;

  // 메뉴 밖을 누르거나 Esc를 누르면 닫는다(터치 기기엔 마우스가 없어 mouseleave로는 안 닫힌다)
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function handleBlock() {
    setOpen(false);
    if (window.confirm(t('menu.blockConfirm'))) {
      blockMutation.mutate(authorId);
    }
  }

  const showOwn = isOwn && (onEdit || onDelete);
  const showOthers = !isOwn;
  if (!showOwn && !showOthers && !onTogglePin) return null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        aria-label={t('menu.ariaLabel')}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <EllipsisVertical size={18} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.dropdown} role="menu">
          {isOwn && onEdit ? (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              <Pencil size={15} aria-hidden="true" />
              {t('action.edit', { ns: 'common' })}
            </button>
          ) : null}
          {onTogglePin ? (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                onTogglePin();
              }}
            >
              {pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
              {t(pinned ? 'detail.unpin' : 'detail.pin')}
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              role="menuitem"
              className={styles.danger}
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
              {t('action.delete', { ns: 'common' })}
            </button>
          ) : null}
          {!isOwn ? (
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
          ) : null}
        </div>
      ) : null}
      {showReport ? (
        <ReportModal targetType={targetType} targetId={targetId} onClose={() => setShowReport(false)} onReported={onReported} />
      ) : null}
    </div>
  );
}
