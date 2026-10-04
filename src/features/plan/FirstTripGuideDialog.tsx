import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from './AddPlaceModal.module.css';
import styles from './FirstTripGuideDialog.module.css';

/** 처음 새 여행을 만들려는 회원에게 — 가이드를 볼지, 바로 만들지 묻는다. 닫기(Esc)는 '바로 만들기'와 같다 */
export function FirstTripGuideDialog({ onSkip, onOpenGuide }: { onSkip: () => void; onOpenGuide: () => void }) {
  const { t } = useTranslation('plan');
  const trapRef = useFocusTrap<HTMLDivElement>(onSkip);
  return (
    <div className={modalStyles.overlay}>
      <div ref={trapRef} className={modalStyles.sheet} role="dialog" aria-modal="true" aria-label={t('firstTripGuide.title')} onClick={(e) => e.stopPropagation()}>
        <span className={styles.icon} aria-hidden="true">
          <BookOpen size={26} />
        </span>
        <h2 className={modalStyles.title}>{t('firstTripGuide.title')}</h2>
        <p className={styles.body}>{t('firstTripGuide.body')}</p>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.secondary} onClick={onSkip}>
            {t('firstTripGuide.skip')}
          </button>
          <button type="button" className={modalStyles.primary} onClick={onOpenGuide}>
            {t('firstTripGuide.open')}
          </button>
        </div>
      </div>
    </div>
  );
}
