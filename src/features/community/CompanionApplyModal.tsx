import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { useApplyToCompanionPost } from './hooks/useCompanionPosts';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './CompanionApplyModal.module.css';

interface CompanionApplyModalProps {
  postId: string;
  onClose: () => void;
}

const MAX_MESSAGE_LENGTH = 500;

/** 동행 모집글 지원 모달 (0032 create_moderated_companion_application) */
export function CompanionApplyModal({ postId, onClose }: CompanionApplyModalProps) {
  const { t } = useTranslation(['community', 'common']);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  const applyMutation = useApplyToCompanionPost(postId);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    setErrorMessage(null);
    try {
      const result = await applyMutation.mutateAsync(message.trim() || undefined);
      if (result.status === 'removed') {
        setErrorMessage(t('compose.moderationBlockedError'));
        return;
      }
      setDone(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('companion.apply.submitError'));
    }
  }

  return (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div
        ref={focusTrapRef}
        className={modalStyles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('companion.apply.dialogLabel')}
      >
        {done ? (
          <>
            <h2 className={modalStyles.title}>{t('companion.apply.doneTitle')}</h2>
            <p className={styles.desc}>{t('companion.apply.doneDesc')}</p>
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.primary} onClick={onClose}>
                {t('action.close', { ns: 'common' })}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={modalStyles.title}>{t('companion.apply.title')}</h2>
            <p className={styles.desc}>{t('companion.apply.messagePrompt')}</p>
            <textarea
              className={styles.messageInput}
              placeholder={t('companion.apply.messagePlaceholder')}
              value={message}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(e) => setMessage(e.target.value)}
            />
            {errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.primary} onClick={onClose}>
                {t('action.cancel', { ns: 'common' })}
              </button>
              <button type="button" className={modalStyles.primary} disabled={applyMutation.isPending} onClick={handleSubmit}>
                {applyMutation.isPending ? t('compose.submitting') : t('companion.apply.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
