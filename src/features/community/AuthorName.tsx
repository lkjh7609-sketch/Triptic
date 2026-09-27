import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './AuthorName.module.css';

interface AuthorNameProps {
  profile: { display_name: string; is_admin?: boolean } | null | undefined;
}

/** 커뮤니티 전역에서 작성자 이름을 보여주는 공통 조각 — 관리자는 이름 옆에
 * 배지가 붙어 일반 사용자와 구분된다(is_admin은 community_profiles 뷰, 0041).
 * 관리자 계정의 표시 이름 자체가 "관리자"라 텍스트 배지를 쓰면 "관리자 관리자"로
 * 겹쳐 보여서 아이콘 배지로 대신한다. */
export function AuthorName({ profile }: AuthorNameProps) {
  const { t } = useTranslation('community');
  return (
    <>
      {profile?.display_name || t('post.fallbackAuthor')}
      {profile?.is_admin ? (
        <ShieldCheck size={14} className={styles.badge} aria-label={t('post.adminBadge')} />
      ) : null}
    </>
  );
}
