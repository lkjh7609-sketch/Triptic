/**
 * 전체 일정 텍스트 포맷 (index.html copyItineraryText 이식 — ADR-001)
 * 원본: index.html copyItineraryText (2026-09-20 기준 라인 7572~7610)의 텍스트
 * 조립 로직. 클립보드 쓰기는 호출부(버튼 핸들러)에서 처리하고, 여기서는 순수
 * 포맷팅만 분리해 테스트 가능하게 만들었다 — 문자열 형식 자체는 원본과 동일하나
 * 문구는 plan:share.text와 plan:mealSlot 아래 번역 키를 쓴다.
 */
import { parseISO } from 'date-fns';
import i18next from '@/shared/i18n';
import { formatLocalizedDay } from './planDateFormat';
import { getEffectiveHotel, type Hotel } from './map/hotels';
import type { PlannerData, HotelsData, PlaceItem } from './types';

function L(key: string, vars?: Record<string, unknown>): string {
  return i18next.t(`plan:share.text.${key}`, vars);
}

function mealLabel(mealType: NonNullable<PlaceItem['mealType']>): string {
  return i18next.t(`plan:mealSlot.${mealType}`);
}

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
  text += `${L('destination', { city: city ?? '' })}\n`;
  text += `${L('period', { start: startDate ?? '', end: endDate ?? '', total: totalDays })}\n\n`;

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = startDate ? formatDayDate(startDate, d) : '';
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `${L('dayHeader', { day: d, date: dateStr })}\n`;

    if (d === 1 && input.outboundFlightLabel) {
      text += `${L('arrival', { label: input.outboundFlightLabel })}\n`;
    }

    const hotel: Hotel | null = getEffectiveHotel(d, hotelsData);
    if (hotel) text += `${L('hotel', { name: hotel.name })}\n`;

    const items = plannerData[d] ?? [];
    if (items.length === 0) {
      text += `  ${L('freeDay')}\n`;
    } else {
      items.forEach((item, idx) => {
        const meal = item.mealType ? `[${mealLabel(item.mealType)}] ` : '';
        text += `  ${idx + 1}. ${item.time ?? ''} ${meal}${item.name}\n`;
        if (item.memo) text += `     ㄴ - ${item.memo}\n`;
      });
    }

    if (d === totalDays && input.returnFlightLabel) {
      text += `${L('departure', { label: input.returnFlightLabel })}\n`;
    }
    text += `\n`;
  }

  return text;
}

function formatDayDate(startDate: string, dayIndex: number): string {
  const start = parseISO(startDate);
  if (Number.isNaN(start.getTime())) return '';
  const date = new Date(start.getTime() + (dayIndex - 1) * 86_400_000);
  return formatLocalizedDay(date, i18next.language);
}
