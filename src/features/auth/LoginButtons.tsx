import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { signInWithProvider, type AuthProvider } from '@/shared/api/authService';
import { captureError } from '@/shared/monitoring';
import styles from './LoginButtons.module.css';

/**
 * 로그인 옵션 (02-screens.md §6)
 * - 제공: Sign in with Apple · Google · Kakao. Apple을 첫 번째로 배치 (심사 시 눈에 띄게)
 * - 약관·개인정보처리방침 동의 체크박스 (사전 체크 금지)
 * ⚠️ Apple: Apple Developer Program 미가입 — Supabase 프로젝트에 Apple OAuth
 * 공급자가 설정되기 전까지는 버튼을 눌러도 인증이 완료되지 않는다 (예상된 동작).
 */
export function LoginButtons() {
  const { t } = useTranslation();
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState<AuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(provider: AuthProvider) {
    if (!agreed || pending) return;
    setError(null);
    setPending(provider);
    try {
      await signInWithProvider(provider);
    } catch (err) {
      captureError(err, { context: 'signInWithProvider', provider });
      setError(t('auth.loginFailed'));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
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

      <button
        type="button"
        className={`${styles.button} ${styles.apple}`}
        disabled={!agreed || pending !== null}
        onClick={() => handleLogin('apple')}
      >
        {pending === 'apple' ? t('auth.connecting') : <><span style={{display:'flex', alignItems:'center'}}><svg width="18" height="18" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" fill="currentColor"/></svg></span> {t('auth.continueApple')}</>}
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.google}`}
        disabled={!agreed || pending !== null}
        onClick={() => handleLogin('google')}
      >
        {pending === 'google' ? t('auth.connecting') : <><span style={{display:'flex', alignItems:'center'}}><svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg></span> {t('auth.continueGoogle')}</>}
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.kakao}`}
        disabled={!agreed || pending !== null}
        onClick={() => handleLogin('kakao')}
      >
        {pending === 'kakao' ? t('auth.connecting') : <><span style={{display:'flex', alignItems:'center'}}><svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C6.477 3 2 6.643 2 11.13c0 2.937 1.956 5.514 4.908 7.014l-1.042 3.844c-.066.24.238.423.44.254l4.475-2.983c.403.05.814.076 1.22.076 5.523 0 10-3.644 10-8.13C22 6.643 17.523 3 12 3z" fill="#191919"/></svg></span> {t('auth.continueKakao')}</>}
      </button>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
