import { useEffect } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { trackScreenView } from '@/shared/monitoring';

/**
 * 홈 탭 — 여행 대시보드 (02-screens.md §2)
 * 통계 타일·세계지도·연도별 타임라인은 Phase 3(날씨+홈 대시보드)에서 구현한다.
 * 지금은 §2.3 "여행 0개" 상태의 골격만 둔다.
 */
export function HomeScreen() {
  useEffect(() => {
    trackScreenView('home');
  }, []);

  return (
    <div>
      <EmptyState
        icon="✈️"
        message="아직 떠난 여행이 없어요. 첫 여행을 만들어 볼까요?"
        actions={
          <Link to="/plan" role="button">
            여행 만들기
          </Link>
        }
      />
    </div>
  );
}
