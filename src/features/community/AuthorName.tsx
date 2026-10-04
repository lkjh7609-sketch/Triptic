import { ShieldCheck, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './AuthorName.module.css';

interface AuthorNameProps {
  profile:
    | {
        display_name: string;
        is_admin?: boolean;
        rating_avg?: number | string | null;
        rating_count?: number | null;
        gender?: 'female' | 'male' | null;
        age_band?: string | null;
      }
    | null
    | undefined;
}

/** 커뮤니티 전역에서 작성자 이름을 보여주는 공통 조각 — 관리자는 이름 옆에
 * 배지가 붙어 일반 사용자와 구분된다(is_admin은 community_profiles 뷰, 0041).
 * 관리자 계정의 표시 이름 자체가 "관리자"라 텍스트 배지를 쓰면 "관리자 관리자"로
 * 겹쳐 보여서 아이콘 배지로 대신한다.
 * 동행 후기(0047)를 받은 사용자는 이름 옆에 평균 별점이 붙는다. */
export function AuthorName({ profile }: AuthorNameProps) {
  const { t } = useTranslation('community');
  const ratingCount = Number(profile?.rating_count ?? 0);
  const ratingAvg = Number(profile?.rating_avg ?? 0);
  // 동행 화면에서만 채워지는 나잇대·성별 — 둘 다 없으면 아무것도 안 보인다
  const demographics = [
    profile?.age_band ? t(`companion.ages.${profile.age_band}`) : null,
    profile?.gender ? t(`companion.gender.${profile.gender}`) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      {profile?.display_name || t('post.fallbackAuthor')}
      {profile?.is_admin ? (
        <ShieldCheck size={14} className={styles.badge} aria-label={t('post.adminBadge')} />
      ) : null}
      {demographics ? (
        <span className={styles.demographics}>{demographics}</span>
      ) : null}
      {ratingCount > 0 ? (
        <span className={styles.rating} title={t('post.ratingLabel', { avg: ratingAvg.toFixed(1), count: ratingCount })}>
          <Star size={12} className={styles.ratingStar} aria-hidden="true" />
          <span aria-label={t('post.ratingLabel', { avg: ratingAvg.toFixed(1), count: ratingCount })}>{ratingAvg.toFixed(1)}</span>
        </span>
      ) : null}
    </>
  );
}
