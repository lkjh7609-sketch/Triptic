import { useEffect } from 'react';
import { EmptyState } from '@/shared/ui/states/EmptyState';
import { trackScreenView } from '@/shared/monitoring';

/**
 * 계획 탭 — 여행 목록 (02-screens.md §3.1)
 * 여행 상세/지도 뷰/일정 편집/서류 업로드는 Phase 2(계획 탭·지도 이식)에서 구현한다.
 * 이 라운드에서는 기존(legacy) 앱의 지도·경로 로직을
 * src/features/plan/map/으로 이식하지 않고 legacy/index.html에 그대로 둔 채
 * 진행한다 (ADR-001 Strangler 전략, Phase 2 패리티 체크리스트 통과 전까지).
 */
export function PlanScreen() {
  useEffect(() => {
    trackScreenView('plan_trip_list');
  }, []);

  return (
    <div>
      <EmptyState
        icon="🧳"
        message="첫 여행을 만들거나, 예약 서류로 바로 시작해 보세요."
      />
    </div>
  );
}
