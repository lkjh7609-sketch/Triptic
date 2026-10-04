import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { changePassword } from '@/shared/api/authService';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { captureError } from '@/shared/monitoring';
import { showToast } from '@/shared/ui/toast';
import modalStyles from '../plan/AddPlaceModal.module.css';

export const MIN_PASSWORD_LENGTH = 8;
const SOCIAL = new Set(['google', 'kakao', 'apple']);

/**
 * 비밀번호 변경 — 이메일로 가입한 회원만 바꿀 수 있다. 구글·카카오·애플로 가입한 회원이 누르면
 * "○○로 가입했어요" 안내만 뜨고 변경은 비활성화된다(사용자 결정 2026-10-05).
 */
export function PasswordChangeDialog({ provider, onClose }: { provider: string | null; onClose: () => void }) {
  const { t } = useTranslation(['settings', 'common']);
  const trapRef = useFocusTrap<HTMLDivElement>(onClose);
  const social = provider !== null && SOCIAL.has(provider);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (social) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('password.tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('password.mismatch'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changePassword(password);
      showToast(t('password.done'), { tone: 'success' });
      onClose();
    } catch (err) {
      captureError(err, { context: 'changePassword' });
      setError(t('password.failed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={modalStyles.overlay}>
      <div ref={trapRef} className={modalStyles.sheet} role="dialog" aria-modal="true" aria-labelledby="password-title" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <h2 id="password-title">{t('password.title')}</h2>
          {social ? <p className={modalStyles.hint} role="status">{t(`password.social.${provider}`)}</p> : null}
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="new-password">
              {t('password.newLabel')}
            </label>
            <input
              id="new-password"
              type="password"
              className={modalStyles.input}
              value={password}
              disabled={social}
              autoComplete="new-password"
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
            />
            <p className={modalStyles.hint}>{t('password.hint', { min: MIN_PASSWORD_LENGTH })}</p>
          </div>
          <div className={modalStyles.field}>
            <label className={modalStyles.label} htmlFor="confirm-password">
              {t('password.confirmLabel')}
            </label>
            <input
              id="confirm-password"
              type="password"
              className={modalStyles.input}
              value={confirm}
              disabled={social}
              autoComplete="new-password"
              onChange={(e) => {
                setConfirm(e.target.value);
                setError(null);
              }}
            />
          </div>
          {error ? (
            <p className={modalStyles.error} role="alert">
              {error}
            </p>
          ) : null}
          <div className={modalStyles.actions}>
            <button type="button" className={modalStyles.secondary} onClick={onClose}>
              {social ? t('common:action.close') : t('common:action.cancel')}
            </button>
            <button type="submit" className={modalStyles.primary} disabled={social || saving}>
              {t('password.change')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
