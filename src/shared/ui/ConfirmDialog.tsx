import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  /** 되돌아가기(다이얼로그를 닫고 아무 것도 안 함) 버튼 라벨 — 실행할 액션과
   * 같은 단어(예: "취소")를 쓰면 네이티브 confirm()의 취소 버튼과 뜻이
   * 헷갈리므로, 호출부마다 명확히 구분되는 문구를 넘긴다(기본값 없음). */
  cancelLabel: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** window.confirm() 대체용 인앱 확인 다이얼로그. 네이티브 confirm은 버튼
 * 라벨을 못 바꿔서, 액션 이름이 "취소"인 경우(모집 취소 등) 다이얼로그의
 * 취소 버튼과 뜻이 겹쳐 사용자가 반대로 누르는 문제가 있었다. */
export function ConfirmDialog({ title, message, cancelLabel, confirmLabel, danger, onConfirm, onClose }: ConfirmDialogProps) {
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);

  return (
    <div className={modalStyles.overlay}>
      <div
        ref={focusTrapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className={modalStyles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`${modalStyles.primary} ${danger ? styles.dangerBtn : ''}`}
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
