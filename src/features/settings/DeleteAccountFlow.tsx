import { useEffect, useState } from 'react';
import { useSession } from '@/shared/hooks/useSession';
import {
  getDeletionImpactSummary,
  requestAccountDeletion,
  type DeletionImpactSummary,
} from '@/shared/api/accountService';
import { signInWithProvider, signOut, type AuthProvider } from '@/shared/api/authService';
import { captureError } from '@/shared/monitoring';
import styles from './DeleteAccountFlow.module.css';

type Step = 'warning' | 'reauth' | 'confirm' | 'done';

const REAUTH_FRESHNESS_MS = 10 * 60 * 1000; // 10분 이내 재로그인만 유효

function isReauthFresh(lastSignInAt: string | undefined): boolean {
  if (!lastSignInAt) return false;
  return Date.now() - new Date(lastSignInAt).getTime() < REAUTH_FRESHNESS_MS;
}

/**
 * 계정 삭제 3단계 흐름 (02-screens.md §5.1)
 * [경고 화면] → 재인증 → "삭제" 입력 확인 → 즉시 반영(로그아웃 + 30일 유예 예약)
 *
 * ⚠️ 재인증은 Supabase OAuth 리다이렉트 기반이라, "다시 로그인" 버튼을 누르면
 * 페이지를 벗어났다가 돌아온다. 돌아온 뒤 세션의 last_sign_in_at이 최근
 * 10분 이내인지로 재인증 성공 여부를 판정한다 — 리다이렉트 흐름을 그대로 유지한
 * 화면 내 상태 보존보다 이 방식이 더 견고하다.
 * ⚠️ 0011_account_deletion_request.sql이 운영 프로젝트에 적용되기 전까지는
 * 마지막 단계에서 실제 RPC 호출이 실패한다 (예상된 동작 — supabase/migrations/README.md 참고).
 */
export function DeleteAccountFlow() {
  const { user } = useSession();
  const [step, setStep] = useState<Step>('warning');
  const [impact, setImpact] = useState<DeletionImpactSummary | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getDeletionImpactSummary()
      .then(setImpact)
      .catch((err) => captureError(err, { context: 'getDeletionImpactSummary' }));
  }, []);

  if (!user) {
    return <p className={styles.step}>로그인 후 이용할 수 있어요.</p>;
  }

  const provider = (user.app_metadata?.provider as AuthProvider | undefined) ?? 'google';
  const reauthFresh = isReauthFresh(user.last_sign_in_at);

  async function handleReauth() {
    setError(null);
    try {
      await signInWithProvider(provider);
      // OAuth 리다이렉트로 페이지를 벗어난다. 돌아오면 last_sign_in_at이 갱신되어 있다.
    } catch (err) {
      captureError(err, { context: 'reauth-for-deletion', provider });
      setError('재인증을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
  }

  async function handleFinalConfirm() {
    if (confirmText !== '삭제') return;
    setSubmitting(true);
    setError(null);
    try {
      await requestAccountDeletion();
      await signOut();
      setStep('done');
    } catch (err) {
      captureError(err, { context: 'requestAccountDeletion' });
      setError('계정 삭제 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.step}>단계 {['warning', 'reauth', 'confirm', 'done'].indexOf(step) + 1} / 4</p>

      {step === 'warning' && (
        <>
          <h2 className={styles.title}>계정을 삭제할까요?</h2>
          <div className={styles.warningBox} role="alert">
            <p>삭제하면 아래 데이터가 모두 사라져요. 30일 안에는 재로그인으로 되돌릴 수 있어요.</p>
            <ul className={styles.list}>
              <li>여행 {impact ? impact.tripCount : '…'}개</li>
              <li>바우처 {impact ? impact.voucherCount : '…'}건</li>
              <li>커뮤니티 글 {impact ? impact.postCount : '…'}개</li>
            </ul>
          </div>
          <button type="button" className={styles.primary} onClick={() => setStep('reauth')}>
            계속
          </button>
        </>
      )}

      {step === 'reauth' && (
        <>
          <h2 className={styles.title}>본인 확인</h2>
          <p>계정을 삭제하려면 다시 로그인해 본인임을 확인해 주세요.</p>
          {reauthFresh ? (
            <>
              <p className={styles.success}>본인 확인이 완료됐어요.</p>
              <button type="button" className={styles.primary} onClick={() => setStep('confirm')}>
                계속
              </button>
            </>
          ) : (
            <button type="button" className={styles.secondary} onClick={handleReauth}>
              다시 로그인
            </button>
          )}
        </>
      )}

      {step === 'confirm' && (
        <>
          <h2 className={styles.title}>마지막 확인</h2>
          <p>
            아래 입력창에 <strong>삭제</strong>를 입력하면 계정 삭제가 진행돼요.
          </p>
          <input
            className={styles.input}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label="삭제 확인 문구 입력"
            placeholder="삭제"
          />
          <button
            type="button"
            className={styles.primary}
            disabled={confirmText !== '삭제' || submitting}
            onClick={handleFinalConfirm}
          >
            {submitting ? '처리 중…' : '계정 삭제'}
          </button>
        </>
      )}

      {step === 'done' && (
        <>
          <h2 className={styles.title}>삭제 요청이 접수됐어요</h2>
          <p>30일 안에 다시 로그인하면 계정을 복구할 수 있어요. 그 뒤에는 완전히 삭제됩니다.</p>
        </>
      )}

      {error ? (
        <p role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
