import type { PlaceItem } from './types';

/** 'HH:mm' → 분(형식이 다르면 null) */
function minutesOf(time: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * 시각을 정하거나 바꾼 항목 하나를 그 시각 자리로 옮긴다(2026-10-17 사용자 — 더 이른 시각이 되면 바로 앞으로).
 * 다른 항목의 순서는 그대로 둔다(직접 끌어 바꾼 순서·시각 없는 항목 자리 보존):
 *  - 같거나 이른 시각인 항목 중 마지막 것 바로 뒤
 *  - 그런 항목이 없으면 시각 있는 첫 항목 바로 앞
 *  - 시각 있는 다른 항목이 없거나, 이 항목에 시각이 없으면 그대로
 */
export function placeByTime(items: PlaceItem[], index: number): PlaceItem[] {
  const item = items[index];
  const t = minutesOf(item?.time);
  if (!item || t === null) return items;
  const rest = items.filter((_, i) => i !== index);
  let lastNotLater = -1;
  let firstTimed = -1;
  rest.forEach((it, i) => {
    const m = minutesOf(it.time);
    if (m === null) return;
    if (firstTimed === -1) firstTimed = i;
    if (m <= t) lastNotLater = i;
  });
  const at = lastNotLater >= 0 ? lastNotLater + 1 : firstTimed;
  if (at < 0) return items;
  rest.splice(at, 0, item);
  return rest;
}
