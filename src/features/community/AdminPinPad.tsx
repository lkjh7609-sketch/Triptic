import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Delete, Lock } from 'lucide-react';
import { openLoginPrompt } from '@/features/auth/loginPrompt';
import { fetchPinStatus, formatCountdown, submitAdminPin } from './adminPinService';
import styles from './AdminPinPad.module.css';

const PIN_LENGTH = 6;
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

type Notice = { kind: 'wrong'; attemptsLeft: number } | { kind: 'error' } | null;

/**
 * 관리자 6자리 비밀번호 — 키보드로 치지 않고 화면의 숫자 버튼을 누른다. 6번째 숫자를 누르면 바로 보낸다.
 * 5번 틀리면 서버가 15분 동안 잠근다(전역). 입력값은 이 컴포넌트 상태에만 있고 보낸 뒤 바로 지운다.
 */
export function AdminPinPad() {
  const { t } = useTranslation('community');
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [shake, setShake] = useState(false);
  /** 잠금이 풀리는 시각(ms) — 없으면 안 잠김 */
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const submitting = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetchPinStatus().then((s) => {
      if (cancelled) return;
      setEnabled(s.enabled);
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
      if (n >= lockedUntil) window.clearInterval(id); // 풀렸으면 더 돌 필요 없다
    }, 500);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const remaining = lockedUntil == null ? 0 : Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = lockedUntil != null && remaining > 0;

  const submit = useCallback(async (pin: string) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setNotice(null);
    const result = await submitAdminPin(pin);
    submitting.current = false;
    setBusy(false);
    setDigits(''); // 맞든 틀리든 입력값은 바로 지운다
    if (result.ok) return; // 로그인 상태가 되면 이 화면은 콘솔로 바뀐다
    setShake(true);
    window.setTimeout(() => setShake(false), 400);
    if (result.kind === 'wrong') {
      if (result.attemptsLeft === 0) setLockedUntil(Date.now() + (result.retryAfter ?? 900) * 1000);
      else setNotice({ kind: 'wrong', attemptsLeft: result.attemptsLeft });
    } else if (result.kind === 'locked') {
      setLockedUntil(Date.now() + result.retryAfter * 1000);
    } else if (result.kind === 'disabled') {
      setEnabled(false);
    } else {
      setNotice({ kind: 'error' });
    }
  }, []);

  function press(d: string) {
    if (busy || locked || digits.length >= PIN_LENGTH) return;
    const next = digits + d;
    setDigits(next);
    setNotice(null);
    if (next.length === PIN_LENGTH) void submit(next);
  }

  if (enabled === false) {
    return (
      <div className={styles.wrap}>
        <Lock size={22} aria-hidden="true" />
        <p className={styles.message}>{t('admin.pin.disabled')}</p>
        <button type="button" className={styles.linkBtn} onClick={openLoginPrompt}>
          {t('admin.pin.useAccount')}
        </button>
      </div>
    );
  }

  const disabled = busy || locked || enabled === null;

  return (
    <div className={styles.wrap}>
      <Lock size={22} aria-hidden="true" />
      <h1 className={styles.title}>{t('admin.pin.title')}</h1>
      <p className={styles.hint}>{t('admin.pin.hint')}</p>

      <div className={`${styles.dots} ${shake ? styles.shake : ''}`} role="img" aria-label={t('admin.pin.entered', { count: digits.length, total: PIN_LENGTH })}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={i < digits.length ? styles.dotOn : styles.dot} />
        ))}
      </div>

      <p className={styles.message} role="status" aria-live="polite">
        {locked
          ? t('admin.pin.locked', { time: formatCountdown(remaining) })
          : notice?.kind === 'wrong'
            ? t('admin.pin.wrong', { count: notice.attemptsLeft })
            : notice?.kind === 'error'
              ? t('admin.pin.error')
              : ''}
      </p>

      <div className={styles.pad}>
        {DIGITS.map((d) => (
          <button key={d} type="button" className={styles.key} disabled={disabled} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" className={styles.key} disabled={disabled} onClick={() => press('0')}>
          0
        </button>
        <button
          type="button"
          className={styles.keyMuted}
          disabled={disabled || digits.length === 0}
          aria-label={t('admin.pin.erase')}
          onClick={() => setDigits((v) => v.slice(0, -1))}
        >
          <Delete size={20} aria-hidden="true" />
        </button>
      </div>

      <button type="button" className={styles.linkBtn} onClick={openLoginPrompt}>
        {t('admin.pin.useAccount')}
      </button>
    </div>
  );
}
