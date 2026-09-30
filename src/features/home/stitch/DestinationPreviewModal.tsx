import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { cityDescQueryKey, fetchCityDescription } from '../cityDescription';
import styles from './DestinationPreviewModal.module.css';

export interface PreviewDestination {
  /** 여행 만들기·AI 소개에 넘기는 도시명(Google Places 검색이 잘 되는 영어 이름) */
  city: string;
  /** 표시 이름(현재 언어) */
  title: string;
  image: string;
  /** AI 소개를 못 받을 때 대신 보여줄 한 줄 */
  fallbackDesc: string;
}

/**
 * 도시 소개 팝업. 한 번 받은 AI 소개는 DB(서버)와 이 기기 캐시에 남아 있어서 다시 열면 바로 보인다.
 * 바깥(어두운 배경)을 눌러도 닫히지 않는다 — 닫기·취소 버튼과 Esc로만 닫는다(팝업 원칙).
 */
export function DestinationPreviewModal({
  dest,
  onClose,
  onStart,
}: {
  dest: PreviewDestination;
  onClose: () => void;
  onStart: () => void;
}) {
  const { t, i18n } = useTranslation(['home', 'common']);
  const locale = i18n.language;
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const { data: aiDesc, isPending: loading } = useQuery({
    queryKey: cityDescQueryKey(dest.city, locale),
    queryFn: () => fetchCityDescription(dest.city, locale),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return createPortal(
    <div className={styles.modalOverlay}>
      <div
        ref={trapRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dest-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.modalClose} onClick={onClose} aria-label={t('common:action.close')}>
          <X size={18} />
        </button>
        <img src={dest.image} className={styles.modalImage} alt="" />
        <div className={styles.modalBody}>
          <h2 id="dest-preview-title" className={styles.modalTitle}>
            {dest.title}
          </h2>
          <div className={styles.modalDesc} aria-live="polite">
            {loading ? <span className={styles.modalLoading}>{t('desktop.previewLoading')}</span> : (aiDesc ?? dest.fallbackDesc)}
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.modalCancel} onClick={onClose}>
              {t('desktop.previewCancel')}
            </button>
            <button type="button" className={styles.modalStart} onClick={onStart}>
              {t('desktop.previewStart')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
