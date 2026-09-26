import { useState, type FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { signInWithEmail, signUpWithEmail } from '@/shared/api/authService';
import { captureError } from '@/shared/monitoring';
import styles from './EmailAuthForm.module.css';

const MIN_PASSWORD_LENGTH = 6; // Supabase Auth 기본 최소 길이

/** Supabase Auth 오류 → 사용자에게 보여줄 번역 키 */
function authErrorKey(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  if (message.includes('invalid login credentials')) return 'auth.email.errorInvalidCredentials';
  if (message.includes('email not confirmed')) return 'auth.email.errorNotConfirmed';
  if (message.includes('already registered')) return 'auth.email.errorAlreadyRegistered';
  if (message.includes('password')) return 'auth.email.errorWeakPassword';
  return 'auth.email.errorGeneric';
}

export function EmailAuthForm() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    if (isSignup && (!name.trim() || !agreed)) return;
    if (isSignup && password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.email.passwordHint', { count: MIN_PASSWORD_LENGTH }));
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      if (isSignup) {
        await signUpWithEmail(email, password, name.trim());
        setMessage(t('auth.email.checkInbox'));
      } else {
        await signInWithEmail(email, password);
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
      </div>
      <div className={styles.inputGroup}>
        <label htmlFor="auth-password">{t('auth.email.password')}</label>
        <input
          id="auth-password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          minLength={isSignup ? MIN_PASSWORD_LENGTH : undefined}
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      {isSignup ? (
        <label className={styles.consent}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
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
