import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';

interface GuestNameModalProps {
  projectName: string;
  onConfirm: (name: string) => void;
}

/** 게스트 이름 입력 (index.html openGuestNameModal/confirmGuestName 이식) */
export function GuestNameModal({ projectName, onConfirm }: GuestNameModalProps) {
  const { t } = useTranslation('community');
  const [name, setName] = useState('');
  const focusTrapRef = useFocusTrap<HTMLDivElement>();

  return (
    <div className={modalStyles.overlay}>
      <div
        ref={focusTrapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('guestName.dialogLabel')}
      >
        <h2 className={modalStyles.title}>✈️ {projectName}</h2>
        <p className={modalStyles.hint}>
          {t('guestName.promptLine1')}
          <br />
          {t('guestName.promptLine2')}
        </p>
        <div className={modalStyles.field}>
          <label className={modalStyles.label}>{t('guestName.nameLabel')}</label>
          <input
            className={modalStyles.input}
            placeholder={t('guestName.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(name);
            }}
          />
        </div>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primary} onClick={() => onConfirm(name)}>
            {t('guestName.enter')}
          </button>
        </div>
      </div>
    </div>
  );
}
