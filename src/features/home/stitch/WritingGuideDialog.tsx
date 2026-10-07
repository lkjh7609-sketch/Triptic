import { Camera, CalendarDays, Hash, ListChecks, MapPin, NotebookPen, PenLine, ShieldCheck, Tags, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './WritingGuideDialog.module.css';

const STEPS: { key: string; icon: ReactNode }[] = [
  { key: 'place', icon: <MapPin size={20} aria-hidden="true" /> },
  { key: 'category', icon: <Tags size={20} aria-hidden="true" /> },
  { key: 'title', icon: <PenLine size={20} aria-hidden="true" /> },
  { key: 'body', icon: <NotebookPen size={20} aria-hidden="true" /> },
  { key: 'photos', icon: <Camera size={20} aria-hidden="true" /> },
  { key: 'tags', icon: <Hash size={20} aria-hidden="true" /> },
  { key: 'trip', icon: <CalendarDays size={20} aria-hidden="true" /> },
  { key: 'after', icon: <ShieldCheck size={20} aria-hidden="true" /> },
];

/**
 * "여행기 작성 가이드" 팝업 — 홈의 "첫 여행기를 남겨보세요" 배너에서 연다. 글쓰기 화면의 실제 규칙
 * (제목 100자·본문 3000자·사진 10장·태그 3개·일정 첨부와 복사 허용·올린 뒤 수정)과 맞춰 적은 안내라서,
 * 글쓰기 규칙을 바꾸면 이 문구(home.json page.stories.guide)도 같이 고친다.
 */
export function WritingGuideDialog({ onClose, onWrite }: { onClose: () => void; onWrite: () => void }) {
  const { t } = useTranslation('home');
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  return (
    <div className={modalStyles.overlay}>
      <div ref={trapRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="writing-guide-title" onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <div>
            <p className={styles.eyebrow}>{t('page.stories.guide.eyebrow')}</p>
            <h2 id="writing-guide-title" className={styles.title}>
              {t('page.stories.guide.title')}
            </h2>
            <p className={styles.lead}>{t('page.stories.guide.lead')}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('page.stories.guide.close')}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <ol className={styles.steps}>
          {STEPS.map(({ key, icon }, i) => (
            <li key={key} className={styles.step}>
              <span className={styles.stepIcon}>{icon}</span>
              <div className={styles.stepText}>
                <h3 className={styles.stepTitle}>
                  <span className={styles.stepNo}>{i + 1}</span>
                  {t(`page.stories.guide.steps.${key}.title`)}
                </h3>
                <p className={styles.stepBody}>{t(`page.stories.guide.steps.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className={styles.tips} aria-label={t('page.stories.guide.tipsTitle')}>
          <h3 className={styles.tipsTitle}>
            <ListChecks size={18} aria-hidden="true" /> {t('page.stories.guide.tipsTitle')}
          </h3>
          <ul className={styles.tipList}>
            {(['tip1', 'tip2', 'tip3', 'tip4'] as const).map((k) => (
              <li key={k}>{t(`page.stories.guide.${k}`)}</li>
            ))}
          </ul>
        </section>

        <footer className={styles.foot}>
          <button type="button" className={modalStyles.secondary} onClick={onClose}>
            {t('page.stories.guide.close')}
          </button>
          <button type="button" className={modalStyles.primary} onClick={onWrite}>
            {t('page.stories.guide.write')}
          </button>
        </footer>
      </div>
    </div>
  );
}
