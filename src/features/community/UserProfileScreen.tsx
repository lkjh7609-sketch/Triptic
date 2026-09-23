import { PenTool } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { trackScreenView } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { getCommunityProfile } from './communityService';
import { useUserPosts } from './hooks/usePosts';
import { PostActionsMenu } from './PostActionsMenu';
import { PostCard } from './PostCard';
import styles from './UserProfileScreen.module.css';

/** 사용자 프로필 (06-community.md §1, §2.5) — 다른 사용자 프로필에는 차단·신고 버튼 */
export function UserProfileScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['community', 'profile', userId ?? ''],
    queryFn: () => getCommunityProfile(userId!),
    enabled: !!userId,
  });
  const { data: posts, isLoading: postsLoading } = useUserPosts(userId, user?.id ?? null);

  useEffect(() => {
    trackScreenView('community_user_profile');
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="100px" />
      </div>
    );
  }
  if (isError || !profile) {
    return <ErrorState summary={t('profile.loadError')} onRetry={() => refetch()} />;
  }

  const isOwn = user?.id === profile.id;

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
        ← {t('action.back', { ns: 'common' })}
      </button>

      <div className={styles.header}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className={styles.avatar} />
        ) : (
          <span className={styles.avatarFallback}>🅤</span>
        )}
        <div className={styles.info}>
          <h1 className={styles.name}>{profile.display_name || t('post.fallbackAuthor')}</h1>
          {profile.handle ? <p className={styles.handle}>@{profile.handle}</p> : null}
          {profile.bio ? <p className={styles.bio}>{profile.bio}</p> : null}
        </div>
        {!isOwn ? (
          <PostActionsMenu targetType="user" targetId={profile.id} authorId={profile.id} />
        ) : null}
      </div>

      <div className={styles.postsHeader}>{t('profile.postsHeader')}</div>
      {postsLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton height="60px" />
        </div>
      ) : !posts || posts.length === 0 ? (
        <EmptyState icon={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><PenTool size={16} /></span>} message={t('profile.noPosts')} />
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </div>
  );
}
