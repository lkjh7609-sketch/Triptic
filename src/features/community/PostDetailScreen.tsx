import { MessageCircle, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useProfile } from '@/shared/hooks/useProfile';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { usePost, useDeletePost, useToggleLike } from './hooks/usePosts';
import { useComments, useCreateComment, useDeleteComment } from './hooks/useComments';
import { PostActionsMenu } from './PostActionsMenu';
import { getPostImageUrl } from './imageProcessing';
import { translateText } from './translateClient';
import type { Locale } from './types';
import styles from './PostDetailScreen.module.css';

export function PostDetailScreen() {
  const { t } = useTranslation(['community', 'common']);
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const viewerLocale = (profile?.locale as Locale | undefined) ?? 'ko';

  const { data: post, isLoading, isError, refetch } = usePost(postId, user?.id ?? null);
  const toggleLike = useToggleLike(postId ?? '', user?.id ?? null);
  const deletePost = useDeletePost();
  const { data: comments } = useComments(postId);
  const createComment = useCreateComment(postId ?? '');
  const deleteComment = useDeleteComment(postId ?? '');

  const [commentBody, setCommentBody] = useState('');
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    trackScreenView('community_post_detail');
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 16 }}>
        <Skeleton height="160px" />
      </div>
    );
  }
  if (isError || !post) {
    return <ErrorState summary={t('detail.loadError')} onRetry={() => refetch()} />;
  }

  const isOwn = user?.id === post.author_id;
  const showTranslateButton = !!post.language && post.language !== viewerLocale;

  async function handleTranslate() {
    setTranslating(true);
    try {
      const result = await translateText(post!.body, post!.language, viewerLocale);
      setTranslated(result);
    } catch (err) {
      captureError(err, { context: 'translatePost' });
    } finally {
      setTranslating(false);
    }
  }

  async function handleDeletePost() {
    if (!window.confirm(t('detail.deleteConfirm'))) return;
    await deletePost.mutateAsync(post!.id);
    navigate('/community');
  }

  async function handleSubmitComment() {
    if (!commentBody.trim()) return;
    try {
      await createComment.mutateAsync({ body: commentBody.trim() });
      setCommentBody('');
    } catch (err) {
      captureError(err, { context: 'createComment' });
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
        ← {t('action.back', { ns: 'common' })}
      </button>

      {post.status !== 'published' ? (
        <p className={styles.statusNotice}>{t(`detail.statusNotice.${post.status}`)}</p>
      ) : null}

      <div className={styles.post}>
        <div className={styles.header}>
          <div className={styles.author} onClick={() => navigate(`/community/user/${post.author_id}`)}>
            {post.author?.avatar_url ? (
              <img src={post.author.avatar_url} alt="" className={styles.avatar} />
            ) : (
              <span className={styles.avatarFallback}>🅤</span>
            )}
            <div>
              <div className={styles.authorName}>{post.author?.display_name || t('post.fallbackAuthor')}</div>
              <div className={styles.time}>
                {post.destination?.name ? `${post.destination.name} · ` : ''}
                {formatDistanceToNowStrict(new Date(post.created_at), { addSuffix: true, locale: ko })}
              </div>
            </div>
          </div>
          <PostActionsMenu
            targetType="post"
            targetId={post.id}
            authorId={post.author_id}
            onDelete={isOwn ? handleDeletePost : undefined}
          />
        </div>

        <p className={styles.body}>{post.body}</p>

        {showTranslateButton ? (
          <div className={styles.translateBlock}>
            {translated ? (
              <>
                <p className={styles.translatedText}>{translated}</p>
                <span className={styles.translatedLabel}>{t('detail.translatedLabel')}</span>
              </>
            ) : (
              <button type="button" className={styles.translateBtn} disabled={translating} onClick={handleTranslate}>
                {translating ? t('detail.translating') : t('detail.translateView')}
              </button>
            )}
          </div>
        ) : null}

        {post.images && post.images.length > 0 ? (
          <div className={styles.imageCarousel}>
            {post.images.map((img) => (
              <a key={img.id} href={getPostImageUrl(img.storage_path)} target="_blank" rel="noopener noreferrer">
                <img src={getPostImageUrl(img.storage_path)} alt="" className={styles.image} />
              </a>
            ))}
          </div>
        ) : null}

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.likeBtn}
            disabled={!user}
            onClick={() => toggleLike.mutate(!!post.likedByMe)}
          >
            {post.likedByMe ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Heart size={16} /></span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Heart size={16} /></span>} {t('detail.like', { count: post.like_count })}
          </button>
          <span className={styles.commentCount}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={16} /></span> {t('detail.comment', { count: post.comment_count })}</span>
        </div>
      </div>

      <div className={styles.comments}>
        {(comments ?? []).map((c) => (
          <div key={c.id} className={styles.commentRow}>
            <div className={styles.commentHeader}>
              <span className={styles.commentAuthor}>{c.author?.display_name || t('post.fallbackAuthor')}</span>
              <span className={styles.commentTime}>
                {formatDistanceToNowStrict(new Date(c.created_at), { addSuffix: true, locale: ko })}
              </span>
              <PostActionsMenu
                targetType="comment"
                targetId={c.id}
                authorId={c.author_id}
                onDelete={user?.id === c.author_id ? () => deleteComment.mutate(c.id) : undefined}
              />
            </div>
            <p className={styles.commentBody}>{c.body}</p>
          </div>
        ))}
        {(comments ?? []).length === 0 ? <EmptyState icon=<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={16} /></span> message={t('detail.noComments')} /> : null}
      </div>

      {user ? (
        <div className={styles.commentInputRow}>
          <input
            className={styles.commentInput}
            placeholder={t('detail.commentPlaceholder')}
            value={commentBody}
            maxLength={500}
            onChange={(e) => setCommentBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitComment();
            }}
          />
          <button
            type="button"
            className={styles.commentSubmitBtn}
            disabled={createComment.isPending || !commentBody.trim()}
            onClick={handleSubmitComment}
          >
            {t('detail.commentSubmit')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
