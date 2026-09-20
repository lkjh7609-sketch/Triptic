import { useEffect, useState } from 'react';
import { useSession } from '@/shared/hooks/useSession';
import { signOut } from '@/shared/api/authService';
import { captureError, trackScreenView } from '@/shared/monitoring';
import { LoginButtons } from '@/features/auth/LoginButtons';
import { DeleteAccountFlow } from './DeleteAccountFlow';
import styles from './SettingsScreen.module.css';

/**
 * 설정 탭 (02-screens.md §5)
 * 이번 라운드는 계정(로그인/로그아웃/계정 삭제) 섹션만 실제로 동작한다.
 * 환경설정(언어·테마·단위)·알림·데이터·정보 섹션은 각각의 담당 Phase
 * (6: i18n/오프라인, 4: 바우처 내보내기, 7: 약관/문의)에서 채운다.
 */
export function SettingsScreen() {
  const { user, loading } = useSession();
  const [showDeleteFlow, setShowDeleteFlow] = useState(false);

  useEffect(() => {
    trackScreenView('settings');
  }, []);

  if (showDeleteFlow) {
    return <DeleteAccountFlow />;
  }

  return (
    <div>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>계정</h2>
        {loading ? null : user ? (
          <>
            <div className={styles.userInfo}>
              <span>{user.email ?? user.user_metadata?.name ?? '내 계정'}</span>
            </div>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => signOut().catch((err) => captureError(err, { context: 'signOut' }))}
              >
                로그아웃
              </button>
            </div>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.dangerLink}
                onClick={() => setShowDeleteFlow(true)}
              >
                계정 삭제
              </button>
            </div>
          </>
        ) : (
          <LoginButtons />
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>환경설정</h2>
        <p className={styles.row}>언어 · 테마 · 단위 (Phase 6 예정)</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>정보</h2>
        <p className={styles.row}>버전 3.0.0-dev</p>
      </section>
    </div>
  );
}
