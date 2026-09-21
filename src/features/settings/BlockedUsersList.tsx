import { useTranslation } from 'react-i18next';
import { useMyBlocks, useUnblockUser } from '@/features/community/hooks/useCommunitySafety';
import styles from './SettingsScreen.module.css';

/**
 * 차단한 사용자 목록 관리 (06-community.md §5.3 "설정 > 차단한 사용자 목록에서 해제 가능")
 * 02-screens.md §5 표에는 별도 행이 없지만 §5.3이 명시적으로 요구해서 커뮤니티
 * 섹션으로 추가했다.
 */
export function BlockedUsersList({ userId }: { userId: string }) {
  const { t } = useTranslation('settings');
  const { data: blocked, isLoading } = useMyBlocks(userId);
  const unblock = useUnblockUser(userId);

  if (isLoading) return null;
  if (!blocked || blocked.length === 0) {
    return <p className={styles.hint}>{t('blocked.empty')}</p>;
  }

  return (
    <div>
      {blocked.map((p) => (
        <div className={styles.row} key={p.id}>
          <span>{p.display_name || t('blocked.unknownUser')}</span>
          <button type="button" className={styles.linkButton} onClick={() => unblock.mutate(p.id)}>
            {t('blocked.unblock')}
          </button>
        </div>
      ))}
    </div>
  );
}
