/**
 * 전체 일정 텍스트 포맷 (index.html copyItineraryText 이식 — ADR-001)
 * 원본: index.html copyItineraryText (2026-09-20 기준 라인 7572~7610)의 텍스트
 * 조립 로직. 클립보드 쓰기는 호출부(버튼 핸들러)에서 처리하고, 여기서는 순수
 * 포맷팅만 분리해 테스트 가능하게 만들었다 — 문자열 형식 자체는 원본과 동일하다.
 */
import { parseISO } from 'date-fns';
import { getEffectiveHotel, type Hotel } from './map/hotels';
import type { PlannerData, HotelsData, PlaceItem } from './types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MEAL_LABEL: Record<NonNullable<PlaceItem['mealType']>, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  cafe: '카페',
};

export interface ItineraryTextInput {
  title: string;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  totalDays: number;
  plannerData: PlannerData;
  hotelsData: HotelsData;
  outboundFlightLabel?: string | null;
  returnFlightLabel?: string | null;
}

export function formatItineraryText(input: ItineraryTextInput): string {
  const { title, city, startDate, endDate, totalDays, plannerData, hotelsData } = input;
  let text = `[${title}]\n`;
  text += `목적지: ${city ?? ''}\n`;
  text += `기간: ${startDate ?? ''} ~ ${endDate ?? ''} (${totalDays}일간)\n\n`;

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = startDate ? formatDayLabel(startDate, d) : '';
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `[${d}일차] ${dateStr}\n`;

    if (d === 1 && input.outboundFlightLabel) {
      text += `도착: ${input.outboundFlightLabel}\n`;
    }

    const hotel: Hotel | null = getEffectiveHotel(d, hotelsData);
    if (hotel) text += `숙소: ${hotel.name}\n`;

    const items = plannerData[d] ?? [];
    if (items.length === 0) {
      text += `  (자유 일정)\n`;
    } else {
      items.forEach((item, idx) => {
        const meal = item.mealType ? `[${MEAL_LABEL[item.mealType]}] ` : '';
        text += `  ${idx + 1}. ${item.time ?? ''} ${meal}${item.name}\n`;
        if (item.memo) text += `     ㄴ - ${item.memo}\n`;
      });
    }

    if (d === totalDays && input.returnFlightLabel) {
      text += `귀국: ${input.returnFlightLabel}\n`;
    }
    text += `\n`;
  }

  return text;
}

function formatDayLabel(startDate: string, dayIndex: number): string {
  const start = parseISO(startDate);
  if (Number.isNaN(start.getTime())) return '';
  const date = new Date(start.getTime() + (dayIndex - 1) * 86_400_000);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAYS[date.getDay()]})`;
}
