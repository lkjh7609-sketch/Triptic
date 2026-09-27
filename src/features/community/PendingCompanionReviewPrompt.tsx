import { useState } from 'react';
import { CompanionReviewModal } from './CompanionReviewModal';
import { useMyActiveCompanionPosts } from './hooks/useCompanionPosts';

const DISMISSED_KEY = 'triptic.companionReviewDismissed';

function readDismissed(): string[] {
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // 사파리 프라이빗 모드 등 — 이번 화면에서만 기억해도 충분하다
  }
}

/** 일정이 끝났는데(closed, 0046) 후기를 안 남긴 동행이 있으면 커뮤니티에 들어올 때
 * 먼저 물어본다. "나중에"로 닫으면 이번 세션에는 그 모임을 다시 묻지 않고,
 * "내 동행" 카드와 채팅방 배너에서 언제든 남길 수 있다. */
export function PendingCompanionReviewPrompt({ userId }: { userId: string }) {
  const { data: posts } = useMyActiveCompanionPosts(userId);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const target = (posts ?? []).find((p) => p.needsReview && !dismissed.includes(p.id));
  if (!target) return null;

  return (
    <CompanionReviewModal
      post={target}
      onClose={() => {
        const next = [...dismissed, target.id];
        writeDismissed(next);
        setDismissed(next);
      }}
    />
  );
}
