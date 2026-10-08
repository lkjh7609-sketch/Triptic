import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { findLoginConflict, onAuthStateChange, rejectLinkedLogin, type LoginConflict } from '@/shared/api/authService';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import styles from './SuspensionGate.module.css';

const KNOWN = new Set(['apple', 'google', 'kakao', 'email']);

/**
 * 이미 다른 방법(Google·카카오·Apple·이메일)으로 가입된 이메일로 다른 방법으로 로그인하면, Supabase가 자동으로 같은 계정에
 * 연결해 버린다. 연결하지 않고 막기로 했으므로 — 방금 붙은 연결을 끊고 로그아웃한 뒤, 어떤 방법으로 가입돼 있고 최근에 어떤
 * 방법으로 로그인했는지 팝업으로 알린다(SuspensionGate와 같은 방식).
 */
export function LoginConflictGate() {
  const [conflict, setConflict] = useState<LoginConflict | null>(null);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    const sub = onAuthStateChange((_event, session) => {
      const found = findLoginConflict(session?.user);
      if (!found) return;
      const key = found.linked.identity_id ?? `${session?.user?.id}:${found.attempted}`;
      if (handled.current.has(key)) return;
      handled.current.add(key);
      // 인증 이벤트 처리기 안에서 바로 supabase를 부르면 멈출 수 있어 한 박자 뒤에
      window.setTimeout(() => {
        void (async () => {
          const { unlinkError } = await rejectLinkedLogin(found.linked).catch((err: unknown) => ({ unlinkError: err }));
          if (unlinkError) captureError(unlinkError, { context: 'rejectLinkedLogin', provider: found.attempted });
          setConflict(found);
        })();
      }, 0);
    });
    return () => sub.unsubscribe();
  }, []);

  if (!conflict) return null;
  return <LoginConflictDialog conflict={conflict} onClose={() => setConflict(null)} />;
}

function LoginConflictDialog({ conflict, onClose }: { conflict: LoginConflict; onClose: () => void }) {
  const { t } = useTranslation('common');
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  const label = (provider: string) => (KNOWN.has(provider) ? t(`loginConflict.provider.${provider}`) : provider);
  const existing = conflict.existing.map(label).join(', ');

  return (
    <div className={styles.overlay}>
      <div ref={focusTrapRef} className={styles.card} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={t('loginConflict.title')}>
        <h2 className={styles.title}>{t('loginConflict.title')}</h2>
        <p className={styles.intro}>{t('loginConflict.intro', { existing, attempted: label(conflict.attempted) })}</p>
        <dl className={styles.facts}>
          <div>
            <dt>{t('loginConflict.recent')}</dt>
            <dd>{label(conflict.recent)}</dd>
          </div>
        </dl>
        <p className={styles.intro}>{t('loginConflict.hint', { recent: label(conflict.recent) })}</p>
        <button type="button" className={styles.close} onClick={onClose}>
          {t('action.close')}
        </button>
      </div>
    </div>
  );
}
