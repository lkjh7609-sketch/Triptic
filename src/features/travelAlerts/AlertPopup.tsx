import type { ReactNode } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import { useAlertLabels } from './useAlertLabels';
import styles from './AlertPopup.module.css';

interface AlertPopupProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

/** 경보 상세 팝업 — 도시 채널의 한 줄 띠와 커뮤니티 홈의 현황 줄이 같이 쓴다. 닫기 버튼·Esc로만 닫는다(바깥을 눌러도 안 닫힘) */
export function AlertPopup({ title, children, onClose }: AlertPopupProps) {
  const { t } = useAlertLabels();
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  return (
    <div className={modalStyles.overlay}>
      <div
        ref={trapRef}
        className={`${modalStyles.sheet} ${styles.sheet}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-popup-title"
      >
        <div className={styles.head}>
          <h2 id="alert-popup-title" className={`${modalStyles.title} ${styles.title}`}>
            <TriangleAlert size={20} aria-hidden="true" className={styles.icon} />
            {title}
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('travelAlert.close')}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
