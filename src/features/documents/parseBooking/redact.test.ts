import { describe, it, expect } from 'vitest';
import { redact } from './redact';

/**
 * 04-document-ai.md §5.2 "이 테스트가 깨지면 배포 불가" 원문 케이스 그대로.
 */
describe('redact', () => {
  const CASES: Array<[string, string]> = [
    ['Passport No: M12345678', 'M12345678'],
    ['여권번호 M87654321', 'M87654321'],
    ['Card 4111-1111-1111-1111', '4111'],
    ['카드 4111 1111 1111 1111', '4111'],
    ['주민번호 900101-1234567', '900101'],
    ['DOB: 1990-01-01', '1990-01-01'],
    ['email: a.b+c@example.co.kr', 'example.co.kr'],
    ['Tel +82-10-1234-5678', '1234'],
    ['Tel +82 2 1234 5678', '1234 5678'],
    ['문의 010-1234-5678', '1234-5678'],
    ['휴대폰 01012345678', '01012345678'],
    ['Phone (212) 555-1234', '555-1234'],
    ['Phone 212-555-1234', '555-1234'],
    ['Card 5555555555554444', '5555555555554444'],
  ];

  it.each(CASES)('%s 를 가린다', (input, secret) => {
    expect(redact(input).text).not.toContain(secret);
  });

  it('편명과 공항코드는 남긴다', () => {
    const { text } = redact('KE801 ICN 08:00 NRT 11:00 2026-05-20');
    expect(text).toContain('KE801');
    expect(text).toContain('ICN');
    expect(text).toContain('08:00');
  });

  it.each([
    // 예약·바우처·주문 번호는 남겨야 AI가 예약번호를 읽는다(예전엔 전화·카드번호로 가려졌다)
    '예약번호 YN2026122400871',
    '바우처 번호 MRT-26110487321',
    'Booking ID 1983344560',
    'Itinerary 72345987112345',
    'Confirmation 4127.339.058 · PIN 7731',
    '예약 번호 1587 2093 44',
    '대표번호 1588-2001',
  ])('%s — 예약 번호는 남긴다', (input) => {
    expect(redact(input).text).toBe(input);
  });

  it('마스킹된 값의 원문은 hits에도 남지 않는다', () => {
    const { hits } = redact('Passport No: M12345678');
    expect(hits.join(' ')).not.toContain('M12345678');
    expect(hits).toContain('[PASSPORT]');
  });

  it('마스킹할 게 없으면 원문 그대로 반환한다', () => {
    const input = '신주쿠 교엔 국립정원 산책';
    expect(redact(input).text).toBe(input);
    expect(redact(input).hits).toEqual([]);
  });
});
