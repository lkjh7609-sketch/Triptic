import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Bookmark } from 'lucide-react';
import { useBookmarkedPosts } from '@/features/community/hooks/usePosts';
import { getPostImageUrl } from '@/features/community/imageProcessing';
import styles from './SavedTravelogues.module.css';
import { postTitleOf } from '@/features/community/postMeta';

/** 내 여행(계획) 탭의 "저장한 여행기" — 커뮤니티에서 저장(북마크)한 글, 최근 저장 순. 글이 지워졌거나 숨겨졌으면 빠진다 */
export function SavedTravelogues({ userId }: { userId: string }) {
  const { t } = useTranslation('plan');
  const { data: posts, isLoading } = useBookmarkedPosts(userId);

  return (
    <section className={styles.section} aria-labelledby="saved-travelogues-title">
      <h2 id="saved-travelogues-title" className={styles.title}>
        <Bookmark size={18} aria-hidden="true" />
        {t('saved.title')}
        {posts && posts.length > 0 ? <span className={styles.count}>{posts.length}</span> : null}
      </h2>
      {isLoading ? null : !posts || posts.length === 0 ? (
        <p className={styles.empty}>{t('saved.empty')}</p>
      ) : (
        <ul className={styles.list}>
          {posts.map((post) => {
            const image = post.images?.[0] ? getPostImageUrl(post.images[0].storage_path) : null;
            return (
              <li key={post.id}>
                <Link to={`/community/post/${post.id}`} className={styles.item}>
                  {image ? <img src={image} alt="" className={styles.thumb} loading="lazy" /> : <span className={styles.thumbEmpty} aria-hidden="true" />}
                  <span className={styles.text}>
                    <span className={styles.itemTitle}>{postTitleOf(post)}</span>
                    <span className={styles.meta}>
                      {[post.destination?.name, post.author?.display_name].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
