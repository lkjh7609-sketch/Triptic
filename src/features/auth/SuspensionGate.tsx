import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { checkMySuspension, onAuthStateChange, signOut } from '@/shared/api/authService';
import { getSupabaseClient } from '@/shared/api/supabaseClient';
import { captureError } from '@/shared/monitoring';
import { useFocusTrap } from '@/shared/a11y/useFocusTrap';
import { SUSPENSION_REASONS } from '@/shared/suspension';
import modalStyles from '@/features/plan/AddPlaceModal.module.css';
import styles from './SuspensionGate.module.css';

interface Suspension {
  reason: string;
  reasonText: string | null;
  suspendedAt: string;
}

/**
 * 운영자가 강제 탈퇴시켜 이용 정지된 이메일로 로그인(또는 다시 가입)하면 곧바로 로그아웃시키고 사유·조치 시각을 팝업으로 알린다.
 * 로그인할 때마다 서버(check_my_suspension, 0095)에 물어본다 — 정지된 사람이 새로 만든 빈 계정은 서버가 지운다. 운영자가 해제하면 다시 들어올 수 있다.
 */
export function SuspensionGate() {
  const [info, setInfo] = useState<Suspension | null>(null);

  useEffect(() => {
    const checked = new Set<string>();
    const sub = onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (!userId || checked.has(userId)) return;
      checked.add(userId);
      // 인증 이벤트 처리기 안에서 바로 supabase를 부르면 멈출 수 있어 한 박자 뒤에
      window.setTimeout(() => {
        void (async () => {
          try {
            const found = await checkMySuspension();
            if (!found) return;
            setInfo(found);
            try {
              await signOut();
            } catch {
              await getSupabaseClient().auth.signOut({ scope: 'local' });
            }
          } catch (err) {
            checked.delete(userId); // 회선 문제 등 — 다음 인증 이벤트에서 다시 확인
            captureError(err, { context: 'checkMySuspension' });
          }
        })();
      }, 0);
    });
    return () => sub.unsubscribe();
  }, []);

  if (!info) return null;
  return <SuspensionDialog info={info} onClose={() => setInfo(null)} />;
}

function SuspensionDialog({ info, onClose }: { info: Suspension; onClose: () => void }) {
  const { t, i18n } = useTranslation('common');
  const focusTrapRef = useFocusTrap<HTMLDivElement>(onClose);
  const code = (SUSPENSION_REASONS as readonly string[]).includes(info.reason) ? info.reason : 'terms';
  const when = new Date(info.suspendedAt).toLocaleString(i18n.language, { dateStyle: 'long', timeStyle: 'short' });

  return (
    <div className={modalStyles.overlay}>
      <div ref={focusTrapRef} className={modalStyles.sheet} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={t('suspension.title')}>
        <h2 className={modalStyles.title}>{t('suspension.title')}</h2>
        <p>{t('suspension.intro')}</p>
        <dl className={styles.facts}>
          <div>
            <dt>{t('suspension.actedAt')}</dt>
            <dd>{when}</dd>
          </div>
          <div>
            <dt>{t('suspension.reason')}</dt>
            <dd>{code === 'custom' && info.reasonText ? info.reasonText : t(`suspension.reasons.${code === 'custom' ? 'terms' : code}`)}</dd>
          </div>
        </dl>
        <div className={modalStyles.actions}>
          <button type="button" className={modalStyles.primary} onClick={onClose}>
            {t('action.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
