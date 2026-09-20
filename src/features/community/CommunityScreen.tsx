import { useEffect } from 'react';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { trackScreenView } from '@/shared/monitoring';

/**
 * 커뮤니티 탭 — 피드 (02-screens.md §4.1)
 * ⚠️ 06-community.md §5(모더레이션 안전장치)가 기능과 같은 PR에서 함께 머지되기
 * 전까지는 실제 피드/글쓰기를 열지 않는다 — Phase 5에서 함께 구현한다.
 */
export function CommunityScreen() {
  useEffect(() => {
    trackScreenView('community_feed');
  }, []);

  return (
    <div>
      <EmptyState icon="💬" message="커뮤니티는 준비 중이에요." />
    </div>
  );
}
