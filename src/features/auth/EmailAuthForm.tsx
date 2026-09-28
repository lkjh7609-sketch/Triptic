import { useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Check, Circle } from 'lucide-react';
import { isEmailAvailable, signInWithEmail, signUpWithEmail } from '@/shared/api/authService';
import { captureError } from '@/shared/monitoring';
import { PASSWORD_MAX_LENGTH, checkPassword, isPasswordValid } from './passwordRules';
import styles from './EmailAuthForm.module.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Supabase Auth 오류 → 사용자에게 보여줄 번역 키 */
function authErrorKey(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'auth.email.errorInvalidCredentials';
  if (message.includes('email not confirmed')) return 'auth.email.errorNotConfirmed';
  if (message.includes('already registered')) return 'auth.email.errorAlreadyRegistered';
  if (message.includes('password')) return 'auth.email.errorWeakPassword';
  return 'auth.email.errorGeneric';
}

interface EmailAuthFormProps {
  /** 약관 동의 — 소셜 로그인 쪽 체크박스와 같은 값을 쓴다 */
  agreed: boolean;
  onAgreedChange: (agreed: boolean) => void;
}

export function EmailAuthForm({ agreed, onAgreedChange }: EmailAuthFormProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [emailCheck, setEmailCheck] = useState<{ email: string; available: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isSignup = mode === 'signup';
  const normalizedEmail = email.trim().toLowerCase();
  // 중복확인 뒤 이메일을 고치면 이전 결과는 무효
  const currentCheck = emailCheck && emailCheck.email === normalizedEmail ? emailCheck : null;
  const passwordChecks = checkPassword(password);

  async function handleCheckEmail() {
    setError(null);
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      setError(t('auth.email.emailInvalid'));
      return;
    }
    setChecking(true);
    try {
      const available = await isEmailAvailable(normalizedEmail);
      setEmailCheck({ email: normalizedEmail, available });
    } catch (err) {
      captureError(err, { context: 'isEmailAvailable' });
      setError(t('auth.email.emailCheckFailed'));
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (isSignup && (!name.trim() || !agreed)) return;
    if (isSignup) {
      if (!currentCheck) {
        setError(t('auth.email.emailCheckRequired'));
        return;
      }
      if (!currentCheck.available) {
        setError(t('auth.email.emailTaken'));
        return;
      }
      if (!isPasswordValid(password)) {
        setError(t('auth.email.passwordInvalid'));
        return;
      }
    }

    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (isSignup) {
        await signUpWithEmail(normalizedEmail, password, name.trim());
        setMessage(t('auth.email.checkInbox'));
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err) {
      captureError(err, { context: isSignup ? 'signUpWithEmail' : 'signInWithEmail' });
      setError(t(authErrorKey(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {isSignup && (
        <div className={styles.inputGroup}>
          <label htmlFor="auth-name">{t('auth.email.name')}</label>
          <input
            id="auth-name"
            type="text"
            autoComplete="name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>
      )}

      <div className={styles.inputGroup}>
        <label htmlFor="auth-email">{t('auth.email.email')}</label>
        <div className={styles.emailRow}>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
          {isSignup ? (
            <button
              type="button"
              className={styles.checkButton}
              onClick={handleCheckEmail}
              disabled={loading || checking || !email.trim()}
            >
              {checking ? t('auth.email.checking') : t('auth.email.checkDuplicate')}
            </button>
          ) : null}
        </div>
        {isSignup && currentCheck ? (
          <p className={currentCheck.available ? styles.okText : styles.error} role="status">
            {currentCheck.available ? t('auth.email.emailAvailable') : t('auth.email.emailTaken')}
          </p>
        ) : null}
      </div>

      <div className={styles.inputGroup}>
        <label htmlFor="auth-password">{t('auth.email.password')}</label>
        <input
          id="auth-password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          maxLength={isSignup ? PASSWORD_MAX_LENGTH : undefined}
          aria-describedby={isSignup ? 'auth-password-rules' : undefined}
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        {isSignup ? (
          <ul id="auth-password-rules" className={styles.rules}>
            {(
              [
                ['length', 'auth.email.pwRuleLength'],
                ['upper', 'auth.email.pwRuleUpper'],
                ['digit', 'auth.email.pwRuleDigit'],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className={passwordChecks[key] ? styles.ruleOk : styles.rule}>
                {passwordChecks[key] ? <Check size={12} aria-hidden="true" /> : <Circle size={12} aria-hidden="true" />}
                {t(label)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {isSignup ? (
        <label className={styles.consent}>
          <input type="checkbox" checked={agreed} onChange={(e) => onAgreedChange(e.target.checked)} />
          <span>
            <Trans
              t={t}
              i18nKey="auth.consent"
              components={{
                terms: <a href="/terms.html" target="_blank" rel="noopener" />,
                privacy: <a href="/privacy.html" target="_blank" rel="noopener" />,
              }}
            />
          </span>
        </label>
      ) : null}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      <div className={styles.actions}>
        <button type="submit" className={styles.primaryButton} disabled={loading || (isSignup && !agreed)}>
          {loading ? t('auth.connecting') : isSignup ? t('auth.email.signUp') : t('auth.email.logIn')}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => {
            setMode(isSignup ? 'login' : 'signup');
            setError(null);
            setMessage(null);
          }}
          disabled={loading}
        >
          {isSignup ? t('auth.email.haveAccount') : t('auth.email.createAccount')}
        </button>
      </div>
    </form>
  );
}
