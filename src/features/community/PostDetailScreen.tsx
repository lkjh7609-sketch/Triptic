import { ArrowRight, BadgeCheck, ChevronLeft, ChevronRight, CalendarDays, Heart, MessageCircle, Pin, Share2, Smile, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { format, formatDistanceToNowStrict } from 'date-fns';
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
import { usePost, useDeletePost, useToggleLike, useAdjacentPosts, usePostTrip } from './hooks/usePosts';
import { useComments, useCreateComment, useDeleteComment, useToggleCommentLike } from './hooks/useComments';
import { useIsAdminViewer, useSetAcceptedComment, useSetPostPinned } from './hooks/usePostMeta';
import { recordPostView } from './communityService';
import { postTitleOf } from './postMeta';
import { AuthorName } from './AuthorName';
import { BookmarkButton } from './BookmarkButton';
import { PostActionsMenu } from './PostActionsMenu';
import { getPostImageUrl } from './imageProcessing';
import { translateText } from './translateClient';
import type { Comment, CommunityProfile, Locale, PostImage } from './types';
import styles from './PostDetailPage.module.css';
import { openLoginPrompt } from '@/features/auth/loginPrompt';
import { LightMarkdown } from './editor/LightMarkdown';

const MAX_COMMENT_LENGTH = 500;
const EMOJIS = ['😀', '😍', '👍', '🙏', '🎉', '😂', '😭', '🔥', '✈️', '🍜', '🌸', '❤️'];

/** 댓글 묶음 — 최상위 댓글과 그 답글(1단계) */
function groupComments(comments: Comment[]): { root: Comment; replies: Comment[] }[] {
  const ids = new Set(comments.map((c) => c.id));
  const roots = comments.filter((c) => !c.parent_id || !ids.has(c.parent_id));
  const rootIds = new Set(roots.map((c) => c.id));
  return roots.map((root) => ({
    root,
    // 답글에 단 답글도 같은 묶음 아래에 놓는다(1단계만 보여 준다)
    replies: comments.filter((c) => c.parent_id && !rootIds.has(c.id) && topParentId(c, comments) === root.id),
  }));
}

function topParentId(c: Comment, all: Comment[]): string | null {
  let cur: Comment | undefined = c;
  for (let i = 0; i < 5 && cur?.parent_id; i += 1) {
    const parent: Comment | undefined = all.find((x) => x.id === cur!.parent_id);
    if (!parent) return null;
    cur = parent;
  }
  return cur?.id ?? null;
}

function Avatar({ profile, size = 40 }: { profile: CommunityProfile | undefined; size?: number }) {
  const initial = (profile?.display_name || '?').trim().charAt(0).toUpperCase();
  return profile?.avatar_url ? (
    <img src={profile.avatar_url} alt="" className={styles.avatar} style={{ width: size, height: size }} />
  ) : (
    <span className={styles.avatarFallback} style={{ width: size, height: size }} aria-hidden="true">
      {initial}
    </span>
  );
}

export function PostDetailScreen() {
  const { t, i18n } = useTranslation(['community', 'common']);
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const viewerLocale = (profile?.locale as Locale | undefined) ?? 'ko';
  const dfLocale = DATE_FNS_LOCALE[i18n.language] ?? DATE_FNS_LOCALE.ko;

  const { data: post, isLoading, isError, refetch } = usePost(postId, user?.id ?? null);
  const toggleLike = useToggleLike(postId ?? '', user?.id ?? null);
  const deletePost = useDeletePost();
  const { data: comments } = useComments(postId, user?.id ?? null);
  const createComment = useCreateComment(postId ?? '');
  const deleteComment = useDeleteComment(postId ?? '');
  const toggleCommentLike = useToggleCommentLike(postId ?? '', user?.id ?? null);
  const { data: isAdminViewer } = useIsAdminViewer(user?.id ?? null);
  const setPinned = useSetPostPinned(postId ?? '');
  const setAccepted = useSetAcceptedComment(postId ?? '');
  const { data: adjacent } = useAdjacentPosts(post?.status === 'published' ? post : undefined);
  const { data: tripPayload } = usePostTrip(post?.trip_id ? post.id : undefined);

  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    trackScreenView('community_post_detail');
  }, []);

  // 조회수 — 로그인한 사용자만, 글마다 한 번(서버가 중복을 막는다). 비로그인 읽기는 그대로 열려 있고 수에는 안 들어간다
  const viewedPostId = post?.status === 'published' ? post.id : null;
  useEffect(() => {
    if (user && viewedPostId) void recordPostView(viewedPostId);
  }, [user, viewedPostId]);

  // 다른 글로 넘어가면 답글 대상·번역·사진 보기를 처음 상태로
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReplyTo(null);
    setTranslated(null);
    setLightbox(null);
    setCommentBody('');
  }, [postId]);

  // 알림에서 특정 댓글로 들어오면(#comment-ID) 그 댓글로 스크롤한다 — 댓글이 불러와진 뒤 한 번
  const scrolledHash = useRef('');
  const hasComments = (comments ?? []).length > 0;
  useEffect(() => {
    if (!hasComments || !hash.startsWith('#comment-') || scrolledHash.current === hash) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    scrolledHash.current = hash;
    el.scrollIntoView({ block: 'center' });
  }, [hasComments, hash]);

  const images: PostImage[] = (post?.images ?? []).slice().sort((a, b) => a.position - b.position);

  // 사진 크게 보기 — Esc로 닫고, 좌우 방향키로 넘긴다
  useEffect(() => {
    if (lightbox === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? i : Math.max(0, i - 1)));
      else if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? i : Math.min(images.length - 1, i + 1)));
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, images.length]);

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
  const canPin = !!isAdminViewer && post.status === 'published' && !!post.destination_id;
  const created = new Date(post.created_at);
  const edited = new Date(post.updated_at).getTime() - created.getTime() > 60_000;
  const threads = groupComments(comments ?? []);
  const commentTotal = (comments ?? []).length;

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
      onSuccess: () => showToast(t(next ? 'detail.pinned' : 'detail.unpinned'), { tone: 'success' }),
      onError: () => showToast(t('detail.pinFailed'), { tone: 'error' }),
    });
  }

  async function handleShare() {
    const url = window.location.href;
    const title = postTitleOf(post!);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast(t('detail.shareCopied'), { tone: 'success' });
    } catch (err) {
      // 공유 창을 닫은 것은 오류가 아니다
      if (err instanceof DOMException && err.name === 'AbortError') return;
      showToast(t('detail.shareFailed'), { tone: 'error' });
    }
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
      await createComment.mutateAsync({ body: commentBody.trim(), parentId: replyTo?.id ?? null });
      setCommentBody('');
      setReplyTo(null);
      setEmojiOpen(false);
    } catch (err) {
      captureError(err, { context: 'createComment' });
    }
  }

  function startReply(c: Comment) {
    if (!user) {
      openLoginPrompt();
      return;
    }
    // 답글에 답해도 묶음의 맨 위 댓글 아래에 붙는다
    const top = c.parent_id ? (comments ?? []).find((x) => x.id === topParentId(c, comments ?? [])) ?? c : c;
    setReplyTo(top);
    commentInputRef.current?.focus();
  }

  function likeComment(c: Comment) {
    if (!user) {
      openLoginPrompt();
      return;
    }
    toggleCommentLike.mutate({ commentId: c.id, liked: !!c.likedByMe });
  }

  function addEmoji(emoji: string) {
    setCommentBody((b) => (b.length + emoji.length <= MAX_COMMENT_LENGTH ? b + emoji : b));
    commentInputRef.current?.focus();
  }

  function renderComment(c: Comment, isReply: boolean) {
    const byAuthor = c.author_id === post!.author_id;
    return (
      <div key={c.id} id={`comment-${c.id}`} className={isReply ? styles.reply : styles.commentItem}>
        <Avatar profile={c.author} size={isReply ? 32 : 36} />
        <div className={styles.commentMain}>
          <div className={`${styles.bubble} ${byAuthor ? styles.bubbleAuthor : ''}`}>
            <div className={styles.commentHeader}>
              <span className={styles.commentAuthor}>
                <AuthorName profile={c.author} />
              </span>
              {byAuthor ? <span className={styles.authorBadge}>{t('detail.authorBadge')}</span> : null}
              <span className={styles.commentTime}>{formatDistanceToNowStrict(new Date(c.created_at), { addSuffix: true, locale: dfLocale })}</span>
              <PostActionsMenu
                targetType="comment"
                targetId={c.id}
                authorId={c.author_id}
                onDelete={user?.id === c.author_id ? () => deleteComment.mutate(c.id) : undefined}
              />
            </div>
            {post!.accepted_comment_id === c.id ? (
              <span className={styles.acceptedBadge}>
                <BadgeCheck size={14} aria-hidden="true" /> {t('detail.acceptedBadge')}
              </span>
            ) : null}
            <p className={styles.commentBody}>{c.body}</p>
          </div>
          <div className={styles.commentActions}>
            <button
              type="button"
              className={`${styles.textBtn} ${c.likedByMe ? styles.textBtnOn : ''}`}
              aria-pressed={!!c.likedByMe}
              onClick={() => likeComment(c)}
            >
              <Heart size={13} fill={c.likedByMe ? 'currentColor' : 'none'} aria-hidden="true" /> {t('detail.commentLike')}
              {(c.like_count ?? 0) > 0 ? ` ${c.like_count}` : ''}
            </button>
            <button type="button" className={styles.textBtn} onClick={() => startReply(c)}>
              {t('detail.reply')}
            </button>
            {isOwn && post!.category === 'qna' && c.author_id !== user?.id ? (
              <button
                type="button"
                className={styles.acceptBtn}
                disabled={setAccepted.isPending}
                onClick={() => toggleAccepted(c.id, post!.accepted_comment_id === c.id)}
              >
                {t(post!.accepted_comment_id === c.id ? 'detail.unaccept' : 'detail.accept')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const trip = tripPayload?.trip;
  const destinationName = post.destination?.name;

  return (
    <div className={styles.page}>
      <nav className={styles.crumbs} aria-label="breadcrumb">
        <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
          <ChevronLeft size={16} aria-hidden="true" /> {t('action.back', { ns: 'common' })}
        </button>
        <span className={styles.crumbSep} aria-hidden="true">/</span>
        <Link to="/community" className={styles.crumbLink}>
          {t('detail.breadcrumbCommunity')}
        </Link>
        {destinationName ? (
          <>
            <span className={styles.crumbSep} aria-hidden="true">/</span>
            <span className={styles.crumbCurrent}>{destinationName}</span>
          </>
        ) : null}
      </nav>

      {post.status !== 'published' ? <p className={styles.statusNotice}>{t(`detail.statusNotice.${post.status}`)}</p> : null}

      <article className={styles.card}>
        <div className={styles.chips}>
          <span className={styles.chip}>
            {destinationName ? `${destinationName} · ` : ''}
            {t(`postCategory.${post.category}`)}
          </span>
          {post.pinned_at ? (
            <span className={styles.chipPinned}>
              <Pin size={12} aria-hidden="true" /> {t('detail.pinnedChip')}
            </span>
          ) : null}
        </div>

        <h1 className={styles.title}>{postTitleOf(post)}</h1>

        <div className={styles.authorRow}>
          <button type="button" className={styles.author} onClick={() => navigate(`/community/user/${post.author_id}`)}>
            <span className={styles.avatarWrap}>
              <Avatar profile={post.author} size={44} />
              {post.author?.is_admin ? <BadgeCheck size={16} className={styles.verified} aria-hidden="true" /> : null}
            </span>
            <span className={styles.authorText}>
              <span className={styles.authorName}>
                <AuthorName profile={post.author} />
                <span className={styles.authorBadge}>{t('detail.authorBadge')}</span>
              </span>
              <span className={styles.meta}>
                {formatDistanceToNowStrict(created, { addSuffix: true, locale: dfLocale })} ({format(created, 'yyyy.MM.dd')})
                {edited ? ` · ${t('detail.edited')}` : ''} · {t('detail.views', { n: post.view_count })}
              </span>
            </span>
          </button>
          <div className={styles.topActions}>
            <button type="button" className={styles.iconBtn} onClick={handleShare} aria-label={t('detail.share')}>
              <Share2 size={18} aria-hidden="true" />
            </button>
            <PostActionsMenu
              targetType="post"
              targetId={post.id}
              authorId={post.author_id}
              onEdit={isOwn ? () => navigate(`/community/post/${post.id}/edit`) : undefined}
              onDelete={isOwn ? handleDeletePost : undefined}
              onTogglePin={canPin ? togglePinned : undefined}
              pinned={!!post.pinned_at}
              onReported={() => navigate('/community', { replace: true })}
            />
          </div>
        </div>

        <hr className={styles.rule} />

        <LightMarkdown text={post.body} className={styles.bodyRich} />

        {showTranslateButton ? (
          <div className={styles.translateBlock}>
            {translated ? (
              <>
                <LightMarkdown text={translated} className={styles.translatedText} />
                <span className={styles.translatedLabel}>{t('detail.translatedLabel')}</span>
              </>
            ) : (
              <button type="button" className={styles.linkBtn} disabled={translating} onClick={handleTranslate}>
                {translating ? t('detail.translating') : t('detail.translateView')}
              </button>
            )}
          </div>
        ) : null}

        {post.trip_id ? (
          <div className={styles.tripCard}>
            <span className={styles.tripIcon} aria-hidden="true">
              <CalendarDays size={22} />
            </span>
            <div className={styles.tripText}>
              <span className={styles.tripLabel}>{t('detail.tripCardLabel')}</span>
              <strong className={styles.tripTitle}>{trip?.title ?? t('postTrip.viewLink')}</strong>
              {trip ? (
                <span className={styles.tripSub}>
                  {[trip.city, trip.total_days ? t('detail.tripCardDays', { n: trip.total_days }) : null].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </div>
            <Link to={`/community/post/${post.id}/trip`} className={styles.tripBtn}>
              {t('detail.tripCardOpen')} <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        ) : null}

        {images.length > 0 ? (
          <section className={styles.photos} aria-label={t('detail.photosTitle', { n: images.length })}>
            <div className={styles.photosHead}>
              <span>{t('detail.photosTitle', { n: images.length })}</span>
              <span className={styles.photosHint}>{t('detail.photosHint')}</span>
            </div>
            <div className={`${styles.photoGrid} ${images.length === 1 ? styles.photoGridOne : ''}`}>
              {images.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  className={styles.photoTile}
                  onClick={() => setLightbox(i)}
                  aria-label={`${t('detail.photoAlt', { n: i + 1 })} — ${t('detail.viewLarge')}`}
                >
                  <img src={getPostImageUrl(img.storage_path)} alt="" className={styles.photo} loading="lazy" />
                  <span className={styles.photoFoot}>{t('detail.viewLarge')}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {post.tags.length > 0 ? (
          <div className={styles.tagRow}>
            {post.tags.map((tag) => (
              <span key={tag} className={styles.tagChip}>
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        <hr className={styles.rule} />

        <div className={styles.actionRow}>
          <div className={styles.actionGroup}>
            <button
              type="button"
              className={`${styles.pillBtn} ${post.likedByMe ? styles.pillBtnOn : ''}`}
              disabled={!user}
              aria-pressed={!!post.likedByMe}
              onClick={() => toggleLike.mutate(!!post.likedByMe)}
            >
              <Heart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} aria-hidden="true" /> {t('detail.like', { count: post.like_count })}
            </button>
            <BookmarkButton post={post} className={styles.pillBtn} />
            <button type="button" className={styles.pillBtn} onClick={handleShare}>
              <Share2 size={16} aria-hidden="true" /> {t('detail.share')}
            </button>
          </div>
          <span className={styles.commentCount}>
            <MessageCircle size={16} aria-hidden="true" /> {t('detail.comment', { count: post.comment_count })}
          </span>
        </div>
      </article>

      <section className={styles.card} aria-labelledby="post-comments-title">
        <div className={styles.commentsHead}>
          <h2 id="post-comments-title" className={styles.commentsTitle}>
            {t('detail.commentsTitle')} <span className={styles.countBadge}>{commentTotal}</span>
          </h2>
          <span className={styles.guide}>{t('detail.commentsGuide')}</span>
        </div>

        {user ? (
          <div className={styles.composer}>
            {replyTo ? (
              <div className={styles.replyingTo}>
                <span>{t('detail.replyingTo', { name: replyTo.author?.display_name || t('post.fallbackAuthor') })}</span>
                <button type="button" className={styles.textBtn} onClick={() => setReplyTo(null)}>
                  {t('detail.replyCancel')}
                </button>
              </div>
            ) : null}
            <textarea
              ref={commentInputRef}
              className={styles.composerInput}
              placeholder={t('detail.commentComposerPlaceholder')}
              value={commentBody}
              maxLength={MAX_COMMENT_LENGTH}
              rows={1}
              onChange={(e) => setCommentBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) handleSubmitComment();
              }}
            />
            <div className={styles.composerFoot}>
              <div className={styles.emojiWrap}>
                <button type="button" className={styles.textBtn} aria-expanded={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>
                  <Smile size={16} aria-hidden="true" /> {t('detail.emoji')}
                </button>
                {emojiOpen ? (
                  <div className={styles.emojiPanel} role="group" aria-label={t('detail.emoji')}>
                    {EMOJIS.map((emoji) => (
                      <button key={emoji} type="button" className={styles.emojiBtn} onClick={() => addEmoji(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <span className={styles.composerCount}>
                {commentBody.length}/{MAX_COMMENT_LENGTH}
              </span>
              <button type="button" className={styles.submitBtn} disabled={createComment.isPending} onClick={handleSubmitComment}>
                {t('detail.commentSubmit')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className={styles.commentLoginBtn} onClick={openLoginPrompt}>
            {t('detail.loginToComment')}
          </button>
        )}

        <div className={styles.commentList}>
          {threads.map(({ root, replies }) => (
            <div key={root.id} className={styles.thread}>
              {renderComment(root, false)}
              {replies.length > 0 ? <div className={styles.replies}>{replies.map((r) => renderComment(r, true))}</div> : null}
            </div>
          ))}
          {threads.length === 0 ? <EmptyState icon={<MessageCircle size={16} />} message={t('detail.noComments')} /> : null}
        </div>
      </section>

      {adjacent && (adjacent.prev || adjacent.next) ? (
        <nav className={styles.adjacent} aria-label={t('detail.prevPost')}>
          {adjacent.prev ? (
            <Link to={`/community/post/${adjacent.prev.id}`} className={styles.adjacentCard}>
              <span className={styles.adjacentLabel}>
                <ChevronLeft size={14} aria-hidden="true" /> {t('detail.prevPost')}
              </span>
              <span className={styles.adjacentTitle}>{postTitleOf(adjacent.prev)}</span>
            </Link>
          ) : (
            <span />
          )}
          {adjacent.next ? (
            <Link to={`/community/post/${adjacent.next.id}`} className={`${styles.adjacentCard} ${styles.adjacentNext}`}>
              <span className={styles.adjacentLabel}>
                {t('detail.nextPost')} <ChevronRight size={14} aria-hidden="true" />
              </span>
              <span className={styles.adjacentTitle}>{postTitleOf(adjacent.next)}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}

      {lightbox !== null && images[lightbox] ? (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={t('detail.photoAlt', { n: lightbox + 1 })}>
          <button type="button" className={styles.lightboxClose} onClick={() => setLightbox(null)} aria-label={t('detail.lightboxClose')}>
            <X size={22} aria-hidden="true" />
          </button>
          {lightbox > 0 ? (
            <button type="button" className={`${styles.lightboxNav} ${styles.lightboxPrev}`} onClick={() => setLightbox(lightbox - 1)} aria-label={t('detail.lightboxPrev')}>
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
          ) : null}
          <img src={getPostImageUrl(images[lightbox].storage_path)} alt={t('detail.photoAlt', { n: lightbox + 1 })} className={styles.lightboxImg} />
          {lightbox < images.length - 1 ? (
            <button type="button" className={`${styles.lightboxNav} ${styles.lightboxNext}`} onClick={() => setLightbox(lightbox + 1)} aria-label={t('detail.lightboxNext')}>
              <ChevronRight size={26} aria-hidden="true" />
            </button>
          ) : null}
          <span className={styles.lightboxCount}>
            {lightbox + 1} / {images.length}
          </span>
        </div>
      ) : null}
    </div>
  );
}
