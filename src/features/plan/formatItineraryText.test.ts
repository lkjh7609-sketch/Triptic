import { describe, it, expect } from 'vitest';
import { formatItineraryText } from './formatItineraryText';

describe('formatItineraryText', () => {
  it('제목·목적지·기간을 헤더에 포함한다', () => {
    const text = formatItineraryText({
      title: '도쿄 여행',
      city: 'Tokyo',
      startDate: '2026-05-20',
      endDate: '2026-05-21',
      totalDays: 2,
      plannerData: {},
      hotelsData: {},
    });
    expect(text).toContain('✈️ [도쿄 여행]');
    expect(text).toContain('📍 목적지: Tokyo');
    expect(text).toContain('📅 기간: 2026-05-20 ~ 2026-05-21 (2일간)');
  });

  it('일정이 없는 날은 "자유 일정"으로 표시한다', () => {
    const text = formatItineraryText({
      title: 't',
      city: null,
      startDate: '2026-05-20',
      endDate: '2026-05-20',
      totalDays: 1,
      plannerData: {},
      hotelsData: {},
    });
    expect(text).toContain('(자유 일정)');
  });

  it('항목을 시간·이름 순으로, 식사 라벨과 메모를 포함해 나열한다', () => {
    const text = formatItineraryText({
      title: 't',
      city: null,
      startDate: '2026-05-20',
      endDate: '2026-05-20',
      totalDays: 1,
      plannerData: {
        1: [
          { name: '라멘 타카하시', time: '12:00', mealType: 'lunch', memo: '웨이팅 있음', lat: 0, lng: 0 },
        ],
      },
      hotelsData: {},
    });
    expect(text).toContain('1. 12:00 [점심] 라멘 타카하시');
    expect(text).toContain('ㄴ 📝 웨이팅 있음');
  });

  it('전날 지정된 숙소를 상속해 표시한다', () => {
    const text = formatItineraryText({
      title: 't',
      city: null,
      startDate: '2026-05-20',
      endDate: '2026-05-21',
      totalDays: 2,
      plannerData: {},
      hotelsData: { 1: { name: '다이이치 호텔', lat: 0, lng: 0 } },
    });
    const day2Section = text.split('[2일차]')[1];
    expect(day2Section).toContain('🏨 숙소: 다이이치 호텔');
  });

  it('유효하지 않은 날짜 문자열이어도 크래시 없이 빈 날짜 라벨로 처리한다', () => {
    const text = formatItineraryText({
      title: 't',
      city: null,
      startDate: '110120-02-06',
      endDate: '110320-02-06',
      totalDays: 1,
      plannerData: {},
      hotelsData: {},
    });
    expect(text).toContain('[1일차]');
  });

  it('첫날/마지막날 항공편 라벨을 포함한다', () => {
    const text = formatItineraryText({
      title: 't',
      city: null,
      startDate: '2026-05-20',
      endDate: '2026-05-21',
      totalDays: 2,
      plannerData: {},
      hotelsData: {},
      outboundFlightLabel: 'KE801 (나리타)',
      returnFlightLabel: 'KE802 (인천)',
    });
    expect(text).toContain('✈️ 도착: KE801 (나리타)');
    expect(text).toContain('✈️ 귀국: KE802 (인천)');
  });
});
