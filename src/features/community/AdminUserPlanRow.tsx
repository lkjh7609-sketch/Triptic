import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { captureError } from '@/shared/monitoring';
import { BASE_FREE_TRIP_LIMIT, MAX_TRIP_LIMIT, adminSetTripLimit, adminSetUserPlan, parseLimit, type AdminUserRow } from './adminService';
import styles from './AdminScreen.module.css';

const QUICK_ADD = [1, 5, 10] as const;

/**
 * 운영 콘솔 "사용자 등급" 한 줄 — 등급(무료/프로) 전환, 무료 여행 생성 한도 확인과 조정.
 * 한도는 "지금까지 만든 수 / 한도 · 남은 수"로 보이고, +1·+5·+10 버튼이나 직접 입력으로 초안을 고친 뒤 저장한다
 * (더하기 요청이 아니라 완성된 값을 서버에 보낸다). 생성 수는 여행을 지워도 줄지 않는 평생 누적이다.
 */
export function AdminUserPlanRow({ user, onChanged }: { user: AdminUserRow; onChanged: (user: AdminUserRow) => void }) {
  const { t } = useTranslation(['community', 'common']);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(String(user.trip_limit));
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const used = user.trips_created_count;
  const draftLimit = parseLimit(draft);
  const left = draftLimit == null ? null : Math.max(0, draftLimit - used);
  const changed = draftLimit != null && draftLimit !== user.trip_limit;

  async function handleToggle() {
    const nextPlan = user.plan === 'pro' ? 'free' : 'pro';
    setBusy(true);
    try {
      await adminSetUserPlan(user.id, nextPlan);
      onChanged({ ...user, plan: nextPlan });
    } catch (err) {
      captureError(err, { context: 'adminSetUserPlan' });
      window.alert(t('admin.planChangeError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveLimit() {
    if (draftLimit == null) return;
    setBusy(true);
    setStatus('idle');
    try {
      const saved = await adminSetTripLimit(user.id, draftLimit);
      onChanged({ ...user, trip_limit: saved });
      setDraft(String(saved));
      setStatus('saved');
    } catch (err) {
      captureError(err, { context: 'adminSetTripLimit' });
      setStatus('error');
    } finally {
      setBusy(false);
    }
  }

  function addToDraft(n: number) {
    setStatus('idle');
    setDraft(String(Math.min(MAX_TRIP_LIMIT, (draftLimit ?? user.trip_limit) + n)));
  }

  const left0 = Math.max(0, user.trip_limit - used);

  return (
    <div className={styles.item}>
      <div className={styles.userRow}>
        <div className={styles.userInfo}>
          <span className={styles.userHandle}>@{user.handle || t('admin.userNoHandle')}</span>
          <span className={styles.userName}>{user.display_name || t('admin.userNoName')}</span>
          <span className={user.plan === 'pro' ? styles.planBadgePro : styles.planBadgeFree}>
            {user.plan === 'pro' ? t('admin.planPro') : t('admin.planFree')}
          </span>
          <span className={styles.tripUsage}>
            {user.plan === 'pro'
              ? t('admin.tripUsagePro', { used })
              : t('admin.tripUsageFree', { used, limit: user.trip_limit, left: left0 })}
            {user.plan === 'free' && user.trip_limit > BASE_FREE_TRIP_LIMIT ? (
              <span className={styles.relaxedBadge}>{t('admin.tripLimitRelaxed', { limit: user.trip_limit, base: BASE_FREE_TRIP_LIMIT })}</span>
            ) : null}
            {user.plan === 'free' && left0 === 0 ? <span className={styles.limitFull}>{t('admin.limit.full')}</span> : null}
          </span>
        </div>
        <button type="button" className={user.plan === 'pro' ? styles.secondaryBtn : styles.primaryBtn} disabled={busy} onClick={handleToggle}>
          {user.plan === 'pro' ? t('admin.revokePro') : t('admin.grantPro')}
        </button>
      </div>

      {user.plan === 'free' ? (
        <div className={styles.limitBox}>
          <label className={styles.limitLabel} htmlFor={`limit-${user.id}`}>
            {t('admin.limit.label')}
          </label>
          <input
            id={`limit-${user.id}`}
            className={styles.limitInput}
            inputMode="numeric"
            value={draft}
            aria-invalid={draftLimit == null}
            onChange={(e) => {
              setStatus('idle');
              setDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 4));
            }}
          />
          {QUICK_ADD.map((n) => (
            <button key={n} type="button" className={styles.chipBtn} disabled={busy} onClick={() => addToDraft(n)}>
              +{n}
            </button>
          ))}
          <button type="button" className={styles.primaryBtn} disabled={busy || !changed} onClick={handleSaveLimit}>
            {t('admin.limit.save')}
          </button>
          <span className={styles.limitPreview} role="status" aria-live="polite">
            {status === 'saved'
              ? t('admin.limit.saved')
              : status === 'error'
                ? t('admin.limit.error')
                : draftLimit == null
                  ? t('admin.limit.invalid', { max: MAX_TRIP_LIMIT })
                  : changed
                    ? t('admin.limit.preview', { limit: draftLimit, left })
                    : ''}
          </span>
        </div>
      ) : null}
    </div>
  );
}
