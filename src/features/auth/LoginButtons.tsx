import { useState } from 'react';
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
      setError('로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
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
          <a href="/terms.html" target="_blank" rel="noopener">
            이용약관
          </a>{' '}
          및{' '}
          <a href="/privacy.html" target="_blank" rel="noopener">
            개인정보처리방침
          </a>
          에 동의합니다
        </span>
      </label>

      <button
        type="button"
        className={`${styles.button} ${styles.apple}`}
        disabled={!agreed || pending !== null}
        onClick={() => handleLogin('apple')}
      >
        {pending === 'apple' ? '연결 중…' : ' Apple로 계속하기'}
      </button>
      <button
        type="button"
        className={styles.button}
        disabled={!agreed || pending !== null}
        onClick={() => handleLogin('google')}
      >
        {pending === 'google' ? '연결 중…' : 'Google로 계속하기'}
      </button>
      <button
        type="button"
        className={styles.button}
        disabled={!agreed || pending !== null}
        onClick={() => handleLogin('kakao')}
      >
        {pending === 'kakao' ? '연결 중…' : '카카오로 계속하기'}
      </button>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
