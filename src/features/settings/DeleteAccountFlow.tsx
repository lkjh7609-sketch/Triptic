import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['settings', 'common']);
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

  const deleteWord = t('action.delete', { ns: 'common' });

  if (!user) {
    return <p className={styles.step}>{t('auth.loginRequired', { ns: 'common' })}</p>;
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
      setError(t('delete.reauthError'));
    }
  }

  async function handleFinalConfirm() {
    if (confirmText !== deleteWord) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestAccountDeletion();
      await signOut();
      setStep('done');
    } catch (err) {
      captureError(err, { context: 'requestAccountDeletion' });
      setError(t('delete.requestError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.step}>
        {t('delete.stepIndicator', {
          current: ['warning', 'reauth', 'confirm', 'done'].indexOf(step) + 1,
          total: 4,
        })}
      </p>

      {step === 'warning' && (
        <>
          <h2 className={styles.title}>{t('delete.warningTitle')}</h2>
          <div className={styles.warningBox} role="alert">
            <p>{t('delete.warningBody')}</p>
            <ul className={styles.list}>
              <li>
                {impact
                  ? t('delete.impact.trips', { count: impact.tripCount })
                  : t('delete.impact.tripsPending')}
              </li>
              <li>
                {impact
                  ? t('delete.impact.vouchers', { count: impact.voucherCount })
                  : t('delete.impact.vouchersPending')}
              </li>
              <li>
                {impact
                  ? t('delete.impact.posts', { count: impact.postCount })
                  : t('delete.impact.postsPending')}
              </li>
            </ul>
          </div>
          <button type="button" className={styles.primary} onClick={() => setStep('reauth')}>
            {t('delete.continue')}
          </button>
        </>
      )}

      {step === 'reauth' && (
        <>
          <h2 className={styles.title}>{t('delete.reauthTitle')}</h2>
          <p>{t('delete.reauthBody')}</p>
          {reauthFresh ? (
            <>
              <p className={styles.success}>{t('delete.reauthSuccess')}</p>
              <button type="button" className={styles.primary} onClick={() => setStep('confirm')}>
                {t('delete.continue')}
              </button>
            </>
          ) : (
            <button type="button" className={styles.secondary} onClick={handleReauth}>
              {t('delete.reauthButton')}
            </button>
          )}
        </>
      )}

      {step === 'confirm' && (
        <>
          <h2 className={styles.title}>{t('delete.confirmTitle')}</h2>
          <p>
            <Trans t={t} i18nKey="delete.confirmBody" components={{ strong: <strong /> }} />
          </p>
          <input
            className={styles.input}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label={t('delete.confirmInputAriaLabel')}
            placeholder={deleteWord}
          />
          <button
            type="button"
            className={styles.primary}
            disabled={confirmText !== deleteWord || submitting}
            onClick={handleFinalConfirm}
          >
            {submitting ? t('delete.processing') : t('account.deleteAction')}
          </button>
        </>
      )}

      {step === 'done' && (
        <>
          <h2 className={styles.title}>{t('delete.doneTitle')}</h2>
          <p>{t('delete.doneBody')}</p>
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
