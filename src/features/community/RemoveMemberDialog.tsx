import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import confirmStyles from '@/shared/ui/ConfirmDialog.module.css';
import { SUSPENSION_REASONS, SUSPENSION_REASON_TEXT_MAX, type SuspensionReason } from '@/shared/suspension';
import { PIN_LENGTH, fetchPinStatus, formatCountdown } from './adminPinService';
import { PinKeypad } from './PinKeypad';
import styles from './AdminMembersTab.module.css';

/** 강제 탈퇴를 시도한 결과 — 보안코드가 틀렸거나 잠긴 경우는 이 창이 직접 보여 준다 */
export type RemoveOutcome =
  | { ok: true }
  | { ok: false; kind: 'wrong'; attemptsLeft: number; retryAfter?: number }
  | { ok: false; kind: 'locked'; retryAfter: number }
  | { ok: false; kind: 'error' };

interface RemoveMemberDialogProps {
  name: string;
  onConfirm: (reason: SuspensionReason, reasonText: string | undefined, pin: string | undefined) => Promise<RemoveOutcome>;
  onClose: () => void;
}

/**
 * 강제 탈퇴 확인 — ① 정지 사유를 고르고 ② 관리자 6자리 보안코드(로그인할 때 쓰는 그 코드)를 누르면 처리한다.
 * 그 이메일은 이용 정지 명단에 올라 다시 가입·로그인하지 못한다. 보안코드를 쓸 수 없게 꺼져 있으면 ②를 건너뛴다(서버가 예전 규칙으로 확인).
 * 처리하는 동안 창이 열린 채 '처리하는 중'을 보이고, 코드가 틀리면 창을 닫지 않고 남은 횟수를 알려 준다.
 */
export function RemoveMemberDialog({ name, onConfirm, onClose }: RemoveMemberDialogProps) {
  const { t } = useTranslation(['community', 'common']);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  const [step, setStep] = useState<'reason' | 'pin'>('reason');
  const [reason, setReason] = useState<SuspensionReason | ''>('');
  const [text, setText] = useState('');
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [wrongLeft, setWrongLeft] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [pinEnabled, setPinEnabled] = useState<boolean | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const submitting = useRef(false);

  const trimmed = text.trim();
  const ready = reason !== '' && (reason !== 'custom' || trimmed.length > 0);
  const title = t('admin.members.remove.title', { ns: 'community', name });
  const remaining = lockedUntil == null ? 0 : Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = lockedUntil != null && remaining > 0;

  useEffect(() => {
    let cancelled = false;
    void fetchPinStatus().then((s) => {
      if (cancelled) return;
      setPinEnabled(s.enabled);
      if (s.locked) setLockedUntil(Date.now() + s.retryAfter * 1000);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (lockedUntil == null) return;
    const id = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const run = useCallback(
    async (pin: string | undefined) => {
      if (!reason || submitting.current) return;
      submitting.current = true;
      setBusy(true);
      setFailed(false);
      const outcome = await onConfirm(reason, reason === 'custom' ? trimmed : undefined, pin).catch((): RemoveOutcome => ({ ok: false, kind: 'error' }));
      submitting.current = false;
      setBusy(false);
      setDigits(''); // 맞든 틀리든 입력값은 바로 지운다
      if (outcome.ok) {
        onClose();
        return;
      }
      if (outcome.kind === 'wrong') {
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        if (outcome.attemptsLeft === 0) setLockedUntil(Date.now() + (outcome.retryAfter ?? 900) * 1000);
        else setWrongLeft(outcome.attemptsLeft);
      } else if (outcome.kind === 'locked') {
        setLockedUntil(Date.now() + outcome.retryAfter * 1000);
      } else {
        setFailed(true); // 알림(토스트)은 부모가 이미 띄웠다 — 창은 열어 두고 다시 시도할 수 있게
      }
    },
    [reason, trimmed, onConfirm, onClose],
  );

  function press(d: string) {
    if (busy || locked || digits.length >= PIN_LENGTH) return;
    const next = digits + d;
    setDigits(next);
    setWrongLeft(null);
    setFailed(false);
    if (next.length === PIN_LENGTH) void run(next);
  }

  const useCode = pinEnabled !== false; // 꺼져 있다고 확인된 때만 건너뛴다(확인 전에는 코드를 묻는 쪽)

  return (
    <div className={modalStyles.overlay}>
      <div ref={focusTrapRef} className={modalStyles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={modalStyles.title}>{title}</h2>

        {step === 'reason' ? (
          <>
            <p className={confirmStyles.message}>{t('admin.members.remove.message', { ns: 'community' })}</p>
            <label className={styles.reasonField}>
              <span>{t('admin.members.remove.reasonLabel', { ns: 'community' })}</span>
              <select value={reason} onChange={(e) => setReason(e.target.value as SuspensionReason | '')}>
                <option value="">{t('admin.members.remove.reasonPlaceholder', { ns: 'community' })}</option>
                {SUSPENSION_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`suspension.reasons.${r}`, { ns: 'common' })}
                  </option>
                ))}
              </select>
            </label>
            {reason === 'custom' ? (
              <label className={styles.reasonField}>
                <span>{t('admin.members.remove.reasonTextLabel', { ns: 'community' })}</span>
                <textarea
                  rows={3}
                  maxLength={SUSPENSION_REASON_TEXT_MAX}
                  value={text}
                  placeholder={t('admin.members.remove.reasonTextPlaceholder', { ns: 'community' })}
                  onChange={(e) => setText(e.target.value)}
                />
                <span className={styles.muted}>
                  {text.length} / {SUSPENSION_REASON_TEXT_MAX}
                </span>
              </label>
            ) : null}
            {failed ? (
              <p className={styles.errorNote} role="alert">
                {t('admin.members.remove.failed', { ns: 'community' })}
              </p>
            ) : null}
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} onClick={onClose}>
                {t('admin.members.remove.cancel', { ns: 'community' })}
              </button>
              <button
                type="button"
                className={`${modalStyles.primary} ${confirmStyles.dangerBtn}`}
                disabled={!ready || busy || pinEnabled === null}
                onClick={() => (useCode ? setStep('pin') : void run(undefined))}
              >
                {busy ? t('admin.members.remove.working', { ns: 'community' }) : useCode ? t('admin.members.remove.next', { ns: 'community' }) : t('admin.members.remove.confirm', { ns: 'community' })}
              </button>
            </div>
          </>
        ) : (
          <div className={styles.pinStep}>
            <ShieldCheck size={22} aria-hidden="true" />
            <p className={styles.pinTitle}>{t('admin.members.remove.pinTitle', { ns: 'community' })}</p>
            <p className={styles.muted}>{t('admin.members.remove.pinHint', { ns: 'community' })}</p>
            <PinKeypad
              digits={digits}
              shake={shake}
              disabled={busy || locked}
              message={
                busy
                  ? t('admin.members.remove.working', { ns: 'community' })
                  : locked
                    ? t('admin.pin.locked', { ns: 'community', time: formatCountdown(remaining) })
                    : wrongLeft !== null
                      ? t('admin.pin.wrong', { ns: 'community', count: wrongLeft })
                      : failed
                        ? t('admin.members.remove.failed', { ns: 'community' })
                        : ''
              }
              onDigit={press}
              onErase={() => setDigits((v) => v.slice(0, -1))}
            />
            <div className={modalStyles.actions}>
              <button type="button" className={modalStyles.secondary} disabled={busy} onClick={() => setStep('reason')}>
                {t('admin.members.remove.back', { ns: 'community' })}
              </button>
              <button type="button" className={modalStyles.secondary} disabled={busy} onClick={onClose}>
                {t('admin.members.remove.cancel', { ns: 'community' })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
