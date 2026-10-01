import { Bookmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { useRequireLogin } from '@/features/auth/loginPrompt';
import { showToast } from '@/shared/ui/toast';
import { captureError } from '@/shared/monitoring';
import { useToggleBookmark } from './hooks/usePosts';
import type { Post } from './types';

/** 여행기 저장(북마크) 버튼 — 저장한 글은 내 여행(계획) 탭의 "저장한 여행기"에 모인다. 비로그인은 누르면 로그인 창 */
export function BookmarkButton({ post, className }: { post: Post; className?: string }) {
  const { t } = useTranslation('community');
  const { user } = useSession();
  const requireLogin = useRequireLogin();
  const toggle = useToggleBookmark(post.id, user?.id ?? null);
  const saved = !!post.bookmarkedByMe;

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!requireLogin()) return;
    toggle.mutate(saved, {
      onError: (err) => {
        captureError(err, { context: 'toggleBookmark' });
        showToast(t('bookmark.error'), { tone: 'error' });
      },
    });
  }

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? t('bookmark.savedAria', { count: post.bookmark_count ?? 0 }) : t('bookmark.saveAria', { count: post.bookmark_count ?? 0 })}
    >
      <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" /> {post.bookmark_count ?? 0}
    </button>
  );
}
