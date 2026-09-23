import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ItineraryItemCard } from './ItineraryItemCard';
import type { PlaceItem } from './types';

interface SortableItineraryItemProps {
  id: string;
  index: number;
  item: PlaceItem;
  onClick: () => void;
  onAiSuggest?: () => void;
  weather?: { tempC: number; conditionCode: string } | null;
}

/**
 * 드래그 순서 변경 (DEVELOPMENT_PLAN.md §5, §9 Phase 2: "드래그 순서 변경 (dnd-kit,
 * SortableJS 대체)"). legacy 앱은 SortableJS를 썼지만(§4 ADR-001 "이식 대상"에는
 * 포함되지 않음 — 순서 변경 "결과"만 패리티 대상이고 라이브러리 자체는 스펙이
 * dnd-kit로 못박았다), 드래그 핸들 없이 카드 전체를 길게 눌러 드래그한다
 * (01-design-system.md §6.2 "길게 누르기 → 순서 변경 모드"에 가장 가까운 대응).
 */
export function SortableItineraryItem({ id, index, item, onClick, onAiSuggest, weather }: SortableItineraryItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ItineraryItemCard index={index} item={item} onClick={onClick} onAiSuggest={onAiSuggest} weather={weather} />
    </div>
  );
}
