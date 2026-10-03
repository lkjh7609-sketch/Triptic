import { BadgeCheck, MessageCircle, Heart, Pin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatDistanceToNowStrict } from 'date-fns';
import { DATE_FNS_LOCALE } from '@/features/plan/planDateFormat';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { showToast } from '@/shared/ui/toast';
import { flagInvalid } from '@/shared/ui/invalidField';
import { useProfile } from '@/shared/hooks/useProfile';
import { trackScreenView, captureError } from '@/shared/monitoring';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { ErrorState } from '@/shared/ui/states/ErrorState';
import { Skeleton } from '@/shared/ui/states/Skeleton';
import { usePost, useDeletePost, useToggleLike } from './hooks/usePosts';
import { useComments, useCreateComment, useDeleteComment } from './hooks/useComments';
import { useIsAdminViewer, useSetAcceptedComment, useSetPostPinned } from './hooks/usePostMeta';
import { recordPostView } from './communityService';
import { AuthorName } from './AuthorName';
import { BookmarkButton } from './BookmarkButton';
import { PostActionsMenu } from './PostActionsMenu';
import { getPostImageUrl } from './imageProcessing';
import { translateText } from './translateClient';
import type { Locale } from './types';
import styles from './PostDetailScreen.module.css';
import { openLoginPrompt } from '@/features/auth/loginPrompt';
import { LightMarkdown } from './editor/LightMarkdown';

export function PostDetailScreen() {
  const { t, i18n } = useTranslation(['community', 'common']);
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
  const { data: isAdminViewer } = useIsAdminViewer(user?.id ?? null);
  const setPinned = useSetPostPinned(postId ?? '');
  const setAccepted = useSetAcceptedComment(postId ?? '');

  const [commentBody, setCommentBody] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    trackScreenView('community_post_detail');
  }, []);

  // 조회수 — 로그인한 사용자만, 글마다 한 번(서버가 중복을 막는다). 비로그인 읽기는 그대로 열려 있고 수에는 안 들어간다
  const viewedPostId = post?.status === 'published' ? post.id : null;
  useEffect(() => {
    if (user && viewedPostId) void recordPostView(viewedPostId);
  }, [user, viewedPostId]);

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

  function togglePinned() {
    const next = !post!.pinned_at;
    setPinned.mutate(next, {
      onSuccess: () =>
        showToast(t(next ? 'detail.pinned' : 'detail.unpinned'), { tone: 'success' }),
      onError: () => showToast(t('detail.pinFailed'), { tone: 'error' }),
    });
  }

  function toggleAccepted(commentId: string, accepted: boolean) {
    setAccepted.mutate(accepted ? null : commentId, {
      onError: () => showToast(t('detail.acceptFailed'), { tone: 'error' }),
    });
  }

  async function handleSubmitComment() {
    if (!commentBody.trim()) {
      flagInvalid(commentInputRef.current);
      return;
    }
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
              <div className={styles.authorName}><AuthorName profile={post.author} /></div>
              <div className={styles.time}>
                {post.destination?.name ? `${post.destination.name} · ` : ''}
                {t(`postCategory.${post.category}`)} ·{' '}
                {formatDistanceToNowStrict(new Date(post.created_at), {
                  addSuffix: true,
                  locale: DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko,
                })}
              </div>
            </div>
          </div>
          <PostActionsMenu
            targetType="post"
            targetId={post.id}
            authorId={post.author_id}
            onDelete={isOwn ? handleDeletePost : undefined}
            onReported={() => navigate('/community', { replace: true })}
          />
        </div>

        <LightMarkdown text={post.body} className={styles.bodyRich} />

        {post.tags.length > 0 ? (
          <div className={styles.tagRow}>
            {post.tags.map((tag) => (
              <span key={tag} className={styles.tagChip}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {isAdminViewer && post.status === 'published' && post.destination_id ? (
          <button
            type="button"
            className={styles.translateBtn}
            disabled={setPinned.isPending}
            onClick={togglePinned}
          >
            <Pin size={14} aria-hidden="true" /> {t(post.pinned_at ? 'detail.unpin' : 'detail.pin')}
          </button>
        ) : null}

        {post.trip_id ? (
          <p style={{ margin: 'var(--space-2) 0 0' }}>
            <Link to={`/community/post/${post.id}/trip`} className={styles.translateBtn}>
              {t('postTrip.viewLink')} →
            </Link>
          </p>
        ) : null}

        {showTranslateButton ? (
          <div className={styles.translateBlock}>
            {translated ? (
              <>
                <LightMarkdown text={translated} className={styles.translatedText} />
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
          <BookmarkButton post={post} className={styles.likeBtn} />
        </div>
      </div>

      <div className={styles.comments}>
        {(comments ?? []).map((c) => (
          <div key={c.id} className={styles.commentRow}>
            <div className={styles.commentHeader}>
              <span className={styles.commentAuthor}><AuthorName profile={c.author} /></span>
              <span className={styles.commentTime}>
                {formatDistanceToNowStrict(new Date(c.created_at), { addSuffix: true, locale: DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko })}
              </span>
              <PostActionsMenu
                targetType="comment"
                targetId={c.id}
                authorId={c.author_id}
                onDelete={user?.id === c.author_id ? () => deleteComment.mutate(c.id) : undefined}
              />
            </div>
            {post.accepted_comment_id === c.id ? (
              <span className={styles.acceptedBadge}>
                <BadgeCheck size={14} aria-hidden="true" /> {t('detail.acceptedBadge')}
              </span>
            ) : null}
            <p className={styles.commentBody}>{c.body}</p>
            {isOwn && post.category === 'qna' && c.author_id !== user?.id ? (
              <button
                type="button"
                className={styles.acceptBtn}
                disabled={setAccepted.isPending}
                onClick={() => toggleAccepted(c.id, post.accepted_comment_id === c.id)}
              >
                {t(post.accepted_comment_id === c.id ? 'detail.unaccept' : 'detail.accept')}
              </button>
            ) : null}
          </div>
        ))}
        {(comments ?? []).length === 0 ? <EmptyState icon=<span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={16} /></span> message={t('detail.noComments')} /> : null}
      </div>

      {user ? (
        <div className={styles.commentInputRow}>
          <input
            ref={commentInputRef}
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
            disabled={createComment.isPending}
            onClick={handleSubmitComment}
          >
            {t('detail.commentSubmit')}
          </button>
        </div>
      ) : (
        <button type="button" className={styles.commentLoginBtn} onClick={openLoginPrompt}>
          {t('detail.loginToComment')}
        </button>
      )}
    </div>
  );
}
